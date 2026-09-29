import { join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CLAROTY_API_URL, getClarotyDeviceDetails, validateClarotyRequest, ClarotyApiError } from "./claroty";
import { fetchPolFiles, openInteractiveSshSession, uploadPolFile, type InteractiveSshSession, type SshRequest } from "./ssh";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const publicDir = join(root, "public");
const hostname = Bun.env.HOST || "0.0.0.0";
const port = Number(Bun.env.PORT || 3333);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function badRequest(message: string): Response {
  return json({ error: message }, 400);
}

function validateRequest(value: unknown): SshRequest | string {
  if (!value || typeof value !== "object") return "Nieprawidłowe dane formularza.";
  const body = value as Record<string, unknown>;
  const host = typeof body.host === "string" ? body.host.trim() : "";
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const remoteDirectory =
    typeof body.remoteDirectory === "string" ? body.remoteDirectory.trim() : "";
  const authType = body.authType === "privateKey" ? "privateKey" : "password";
  const portValue = Number(body.port || 22);

  if (!host) return "Podaj adres IP lub nazwę hosta switcha.";
  if (!username) return "Podaj nazwę użytkownika SSH.";
  if (!remoteDirectory || !remoteDirectory.startsWith("/")) {
    return "Katalog zdalny musi być ścieżką absolutną, np. /usr/local/cfg.";
  }
  if (!Number.isInteger(portValue) || portValue < 1 || portValue > 65535) {
    return "Port musi być liczbą od 1 do 65535.";
  }
  if (authType === "password" && (!body.password || typeof body.password !== "string")) {
    return "Podaj hasło SSH.";
  }
  if (authType === "privateKey" && (!body.privateKey || typeof body.privateKey !== "string")) {
    return "Wklej klucz prywatny SSH.";
  }

  return {
    host,
    port: portValue,
    username,
    authType,
    password: typeof body.password === "string" ? body.password : undefined,
    privateKey: typeof body.privateKey === "string" ? body.privateKey : undefined,
    passphrase: typeof body.passphrase === "string" ? body.passphrase : undefined,
    remoteDirectory,
  };
}

function validateUploadRequest(value: unknown): (SshRequest & { policyName: string; content: string; directions: string[] }) | string {
  const connection = validateRequest(value);
  if (typeof connection === "string") return connection;
  const body = value as Record<string, unknown>;
  const policyName = typeof body.policyName === "string" ? body.policyName.trim() : "";
  const content = typeof body.content === "string" ? body.content : "";
  const directions = Array.isArray(body.directions)
    ? body.directions.filter((direction): direction is string => direction === "ingress" || direction === "egress")
    : [];

  if (!policyName) return "Brak nazwy polityki do zapisania.";
  if (!content.trim()) return "Nie można wysłać pustej polityki.";
  if (content.length > 2_000_000) return "Polityka jest zbyt duża (maksymalnie 2 MB).";

  return { ...connection, policyName, content, directions };
}

type TerminalSocketData = {
  session?: InteractiveSshSession;
  connecting?: boolean;
};

type TerminalSocket = Bun.ServerWebSocket<TerminalSocketData>;

function sendTerminalMessage(socket: TerminalSocket, message: Record<string, unknown>): void {
  try {
    socket.send(JSON.stringify(message));
  } catch (error) {
    console.warn(`[Terminal] Nie udało się wysłać komunikatu: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleTerminalMessage(socket: TerminalSocket, rawMessage: string | Buffer): Promise<void> {
  let message: unknown;
  try {
    message = JSON.parse(String(rawMessage));
  } catch {
    sendTerminalMessage(socket, { type: "error", message: "Nieprawidłowy komunikat terminala." });
    return;
  }

  if (!message || typeof message !== "object") return;
  const body = message as Record<string, unknown>;

  if (body.type === "connect") {
    if (socket.data.session || socket.data.connecting) return;
    const request = validateRequest(body.connection);
    if (typeof request === "string") {
      sendTerminalMessage(socket, { type: "error", message: request });
      return;
    }

    socket.data.connecting = true;
    try {
      const session = await openInteractiveSshSession(request, {
        onData(data) {
          sendTerminalMessage(socket, { type: "output", data });
        },
        onClose(error) {
          socket.data.session = undefined;
          socket.data.connecting = false;
          sendTerminalMessage(socket, {
            type: "closed",
            message: error?.message || "Sesja SSH została zamknięta.",
          });
        },
      });
      socket.data.session = session;
      socket.data.connecting = false;
      sendTerminalMessage(socket, { type: "ready" });
      return;
    } catch (error) {
      socket.data.connecting = false;
      sendTerminalMessage(socket, {
        type: "error",
        message: error instanceof Error ? error.message : "Nie udało się otworzyć sesji terminala SSH.",
      });
      return;
    }
  }

  if (body.type === "input" && typeof body.data === "string") {
    socket.data.session?.write(body.data);
    return;
  }

  if (body.type === "resize") {
    const cols = Number(body.cols);
    const rows = Number(body.rows);
    if (Number.isFinite(cols) && Number.isFinite(rows)) socket.data.session?.resize(cols, rows);
  }
}

async function staticFile(pathname: string): Promise<Response> {
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = normalize(join(publicDir, relativePath));
  if (filePath !== publicDir && !filePath.startsWith(`${publicDir}${sep}`)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const file = Bun.file(filePath);
    if (!(await file.exists())) return new Response("Not found", { status: 404 });
    const extension = filePath.slice(filePath.lastIndexOf("."));
    return new Response(file, {
      headers: {
        "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

const server = Bun.serve<TerminalSocketData>({
  hostname,
  port,
  websocket: {
    data: {} as TerminalSocketData,
    open() {},
    message(socket, message) {
      void handleTerminalMessage(socket, message).catch((error) => {
        sendTerminalMessage(socket, {
          type: "error",
          message: error instanceof Error ? error.message : "Nie udało się obsłużyć sesji terminala SSH.",
        });
      });
    },
    close(socket) {
      socket.data.session?.close();
      socket.data.session = undefined;
      socket.data.connecting = false;
    },
  },
  async fetch(request, currentServer) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") return json({ ok: true });

    if (url.pathname === "/api/terminal") {
      if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
        return new Response("WebSocket upgrade required", { status: 426 });
      }
      const upgraded = currentServer.upgrade(request, { data: {} });
      return upgraded ? undefined : new Response("WebSocket upgrade failed", { status: 400 });
    }

    if (url.pathname === "/api/pol-files") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return badRequest("Nie udało się odczytać danych formularza.");
      }

      const parsed = validateRequest(body);
      if (typeof parsed === "string") return badRequest(parsed);

      try {
        const files = await fetchPolFiles(parsed);
        return json({
          files,
          fetchedAt: new Date().toISOString(),
          host: parsed.host,
          directory: parsed.remoteDirectory,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Nieznany błąd SSH/SFTP.";
        console.error(`[SSH] ${parsed.host}: ${message}`);
        return json(
          {
            error:
              "Nie udało się pobrać plików. Sprawdź host, dane logowania, katalog i to, czy switch udostępnia SFTP.",
            details: message,
          },
          502,
        );
      }
    }

    if (url.pathname === "/api/pol-upload") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return badRequest("Nie udało się odczytać danych wysyłanego pliku.");
      }

      const parsed = validateUploadRequest(body);
      if (typeof parsed === "string") return badRequest(parsed);

      try {
        const uploaded = await uploadPolFile(parsed);
        return json(uploaded);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Nieznany błąd SSH/SFTP.";
        console.error(`[SFTP upload] ${parsed.host}: ${message}`);
        return json(
          {
            error: "Nie udało się wysłać zaktualizowanej polityki. Sprawdź uprawnienia SFTP i katalog zdalny.",
            details: message,
          },
          502,
        );
      }
    }

    if (url.pathname === "/api/claroty/config") {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      return json({ apiUrl: DEFAULT_CLAROTY_API_URL });
    }

    if (url.pathname === "/api/claroty/device") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return badRequest("Nie udało się odczytać danych formularza Claroty.");
      }

      const parsed = validateClarotyRequest(body);
      if (typeof parsed === "string") return badRequest(parsed);

      try {
        const result = await getClarotyDeviceDetails(parsed);
        return json(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Nieznany błąd API Claroty.";
        const status = error instanceof ClarotyApiError ? error.status : 502;
        console.error(`[Claroty] ${parsed.apiUrl}: ${message}`);
        return json(
          {
            error: "Nie udało się pobrać informacji o urządzeniu z Claroty.",
            details: message,
          },
          status >= 400 && status < 600 ? status : 502,
        );
      }
    }

    return staticFile(url.pathname);
  },
});

console.log(`Extreme Policy Manager by Elektryczny Krzysztof działa na http://${hostname}:${server.port}`);
