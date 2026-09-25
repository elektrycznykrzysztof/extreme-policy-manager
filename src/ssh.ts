import { Client, type ClientChannel, type ConnectConfig, type SFTPWrapper } from "ssh2";
import { parsePol, type ParsedPolFile } from "./parser";

export interface SshRequest {
  host: string;
  port: number;
  username: string;
  authType: "password" | "privateKey";
  password?: string;
  privateKey?: string;
  passphrase?: string;
  remoteDirectory: string;
}

export interface RemotePolFile {
  name: string;
  path: string;
  size: number;
  modifiedAt: string | null;
  directions: string[];
  content: string;
  parsed: ParsedPolFile;
}

export interface UploadPolRequest extends SshRequest {
  policyName: string;
  content: string;
  directions: string[];
}

export interface SshError extends Error {
  code?: string | number;
}

export interface InteractiveSshSession {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  close(): void;
}

export interface InteractiveSshSessionHandlers {
  onData(data: string): void;
  onClose(error?: Error): void;
}

function connect(config: ConnectConfig): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    const onError = (error: Error) => {
      client.removeAllListeners();
      reject(error);
    };
    client.once("ready", () => resolve(client));
    client.once("error", onError);
    client.connect(config);
  });
}

function openSftp(client: Client): Promise<SFTPWrapper> {
  return new Promise((resolve, reject) => {
    client.sftp((error, sftp) => {
      if (error) reject(error);
      else resolve(sftp);
    });
  });
}

function readDirectory(sftp: SFTPWrapper, directory: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    sftp.readdir(directory, (error, list) => {
      if (error) reject(error);
      else resolve(list);
    });
  });
}

function readFile(sftp: SFTPWrapper, path: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    sftp.readFile(path, (error, buffer) => {
      if (error) reject(error);
      else resolve(buffer);
    });
  });
}

function writeFile(sftp: SFTPWrapper, path: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.writeFile(path, Buffer.from(content, "utf8"), (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function executeCommand(client: Client, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    client.exec(command, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }

      let output = "";
      let errorOutput = "";
      stream.setEncoding("utf8");
      stream.on("data", (chunk: string) => { output += chunk; });
      stream.stderr.on("data", (chunk: string) => { errorOutput += chunk; });
      stream.once("close", (code: number | undefined) => {
        if (code && code !== 0 && !output.trim()) {
          reject(new Error(errorOutput.trim() || `Polecenie zakończyło się kodem ${code}.`));
          return;
        }
        resolve(output);
      });
    });
  });
}

function openShell(client: Client): Promise<ClientChannel> {
  return new Promise((resolve, reject) => {
    client.shell(
      {
        term: "xterm-256color",
        cols: 120,
        rows: 32,
        width: 1200,
        height: 640,
      },
      (error, stream) => {
        if (error) reject(error);
        else resolve(stream);
      },
    );
  });
}

export async function openInteractiveSshSession(
  request: SshRequest,
  handlers: InteractiveSshSessionHandlers,
): Promise<InteractiveSshSession> {
  const client = await connect(asConnectConfig(request));
  let channel: ClientChannel;
  try {
    channel = await openShell(client);
  } catch (error) {
    client.end();
    throw error;
  }

  let closed = false;
  const close = (error?: Error) => {
    if (closed) return;
    closed = true;
    client.end();
    handlers.onClose(error);
  };

  channel.setEncoding("utf8");
  channel.on("data", (chunk: string | Buffer) => handlers.onData(String(chunk)));
  channel.stderr.setEncoding("utf8");
  channel.stderr.on("data", (chunk: string | Buffer) => handlers.onData(String(chunk)));
  channel.once("close", () => close());
  channel.once("end", () => close());
  channel.once("error", (error: Error) => close(error));
  client.once("error", (error: Error) => close(error));

  return {
    write(data) {
      if (!closed) channel.write(data);
    },
    resize(cols, rows) {
      if (closed) return;
      const safeCols = Math.max(20, Math.min(300, Math.floor(cols)));
      const safeRows = Math.max(5, Math.min(100, Math.floor(rows)));
      channel.setWindow(safeRows, safeCols, safeRows * 20, safeCols * 8);
    },
    close() {
      if (closed) return;
      closed = true;
      channel.close();
      client.end();
    },
  };
}

function policyKey(name: string): string {
  return name.replace(/\.pol$/i, "").trim().toLowerCase();
}

export function parseAccessListDirections(output: string): Map<string, string[]> {
  const directions = new Map<string, string[]>();
  const lines = output.replace(/\r\n?/g, "\n").split("\n");
  const header = lines.find((line) => /Policy\s+Name/i.test(line) && /\bDir\b/i.test(line));

  if (header) {
    const policyStart = header.toLowerCase().indexOf("policy name");
    const directionStart = header.toLowerCase().indexOf("dir", policyStart + 1);
    const rulesStart = header.toLowerCase().indexOf("rules", directionStart + 1);
    if (policyStart >= 0 && directionStart > policyStart && rulesStart > directionStart) {
      for (const line of lines) {
        if (!line.trim() || line === header || /^\s*=+\s*$/.test(line)) continue;
        const name = line.slice(policyStart, directionStart).trim();
        const direction = line.slice(directionStart, rulesStart).trim().toLowerCase();
        if (!name || !/^(ingress|egress)$/i.test(direction)) continue;
        const key = policyKey(name);
        const values = directions.get(key) ?? [];
        if (!values.includes(direction)) values.push(direction);
        directions.set(key, values);
      }
    }
  }

  // Fallback dla wariantów outputu, w których odstępy kolumn są zmienione.
  if (!directions.size) {
    for (const line of lines) {
      const row = line.match(/^\s*\S+\s+\S+\s+(.+?)\s+(ingress|egress)\s+\d+\s+\d+\s*$/i);
      if (!row) continue;
      const key = policyKey(row[1]);
      const direction = row[2].toLowerCase();
      const values = directions.get(key) ?? [];
      if (!values.includes(direction)) values.push(direction);
      directions.set(key, values);
    }
  }

  return directions;
}

function joinRemotePath(directory: string, name: string): string {
  return `${directory.replace(/\/+$/, "")}/${name}`;
}

function vlanPolicyBaseName(policyName: string): string {
  const match = policyName.match(/vlan[\s._-]*(\d+)/i);
  return match ? `vlan${match[1]}` : "vlan";
}

function exportTimestamp(date: Date): string {
  const format = (timeZone: string) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}-${values.hour}-${values.minute}-${values.second}`;
  };

  try {
    return format(Bun.env.EXPORT_TIME_ZONE || "Europe/Warsaw");
  } catch {
    return format("Europe/Warsaw");
  }
}

function uploadFileName(policyName: string, directions: string[], date = new Date()): string {
  const timestamp = exportTimestamp(date);
  const directionPart = [...new Set(directions.filter((direction) => direction === "ingress" || direction === "egress"))].join("-");
  const directionSuffix = directionPart ? `-${directionPart}` : "";
  return `${vlanPolicyBaseName(policyName)}${directionSuffix}-${timestamp}.pol`;
}

function asConnectConfig(request: SshRequest): ConnectConfig {
  const config: ConnectConfig = {
    host: request.host,
    port: request.port,
    username: request.username,
    readyTimeout: 12_000,
    keepaliveInterval: 5_000,
    keepaliveCountMax: 2,
  };

  if (request.authType === "privateKey") {
    config.privateKey = request.privateKey;
    if (request.passphrase) config.passphrase = request.passphrase;
  } else {
    config.password = request.password;
  }

  return config;
}

export async function fetchPolFiles(request: SshRequest): Promise<RemotePolFile[]> {
  const client = await connect(asConnectConfig(request));
  try {
    let directions = new Map<string, string[]>();
    try {
      const accessListOutput = await executeCommand(client, "show access-list");
      directions = parseAccessListDirections(accessListOutput);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nieznany błąd polecenia show access-list.";
      console.warn(`[SSH] show access-list: ${message}`);
    }

    const sftp = await openSftp(client);
    const entries = await readDirectory(sftp, request.remoteDirectory);
    const files = entries
      .filter((entry) => entry.filename.toLowerCase().endsWith(".pol"))
      .filter((entry) => !entry.attrs.isDirectory())
      .sort((left, right) => left.filename.localeCompare(right.filename));

    const result: RemotePolFile[] = [];
    for (const entry of files) {
      const path = joinRemotePath(request.remoteDirectory, entry.filename);
      const buffer = await readFile(sftp, path);
      const content = buffer.toString("utf8");
      result.push({
        name: entry.filename,
        path,
        size: entry.attrs.size ?? buffer.byteLength,
        modifiedAt: entry.attrs.mtime
          ? new Date(entry.attrs.mtime * 1000).toISOString()
          : null,
        directions: directions.get(policyKey(entry.filename)) ?? [],
        content,
        parsed: parsePol(content),
      });
    }
    return result;
  } finally {
    client.end();
  }
}

export async function uploadPolFile(request: UploadPolRequest): Promise<{
  name: string;
  path: string;
  uploadedAt: string;
}> {
  const client = await connect(asConnectConfig(request));
  try {
    const sftp = await openSftp(client);
    const name = uploadFileName(request.policyName, request.directions);
    const path = joinRemotePath(request.remoteDirectory, name);
    await writeFile(sftp, path, request.content);
    return { name, path, uploadedAt: new Date().toISOString() };
  } finally {
    client.end();
  }
}
