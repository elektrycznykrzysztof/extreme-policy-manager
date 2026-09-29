import { isIP } from "node:net";

export const DEFAULT_CLAROTY_API_URL = Bun.env.CLAROTY_API_URL || "https://eu.api.medigate.io";

const CLAROTY_DEVICE_FIELDS = [
  "uid", "asset_id", "device_type", "network_list", "device_category", "ip_list", "device_subcategory",
  "mac_list", "risk_score_points", "risk_score", "device_name", "manufacturer", "model", "os_name", "os_version",
  "site_name", "purdue_level", "serial_number", "vlan_list", "switch_name_list", "switch_port_list", "ap_name_list",
  "first_seen_list", "last_seen_list", "note", "labels", "assignees", "retired",
];

export type ClarotyRequest = {
  apiUrl: string;
  ip: string;
  disableTls: boolean;
};

export class ClarotyApiError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "ClarotyApiError";
    this.status = status;
  }
}

function normalizeApiUrl(value: string): string {
  const raw = value.trim() || DEFAULT_CLAROTY_API_URL;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ClarotyApiError("Adres API Claroty jest nieprawidłowy.", 400);
  }

  if (parsed.protocol !== "https:") {
    throw new ClarotyApiError("Adres API Claroty musi używać HTTPS.", 400);
  }

  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.toString().replace(/\/$/, "");
}

function appendPath(baseUrl: string, path: string): string {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function readResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function responseMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim()) return payload.trim().slice(0, 800);
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["message", "error", "detail", "description"]) {
      if (typeof record[key] === "string" && record[key].trim()) return record[key].trim().slice(0, 800);
    }
  }
  return fallback;
}

function getClarotyCredentials(): { apiUser: string; token: string } {
  const apiUser = (Bun.env.CLAROTY_API_USER || "").trim();
  const token = (Bun.env.CLAROTY_API_TOKEN || "")
    .trim()
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!apiUser) {
    throw new ClarotyApiError("Brak CLAROTY_API_USER w zmiennych środowiskowych.", 500);
  }
  if (!token) {
    throw new ClarotyApiError("Brak CLAROTY_API_TOKEN w zmiennych środowiskowych.", 500);
  }

  return { apiUser, token };
}

function extractDevices(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of ["devices", "data", "results", "items"]) {
    if (Array.isArray(record[key])) return record[key];
  }
  return [payload];
}

export function validateClarotyRequest(value: unknown): ClarotyRequest | string {
  if (!value || typeof value !== "object") return "Nieprawidłowe dane formularza Claroty.";
  const body = value as Record<string, unknown>;
  const apiUrl = typeof body.apiUrl === "string" ? body.apiUrl : DEFAULT_CLAROTY_API_URL;
  const ip = typeof body.ip === "string" ? body.ip.trim() : "";
  const disableTls = body.disableTls === true || body.disableTls === "true" || body.disableTls === "on";

  if (!ip || isIP(ip) === 0) return "Podaj poprawny adres IP urządzenia.";

  try {
    return { apiUrl: normalizeApiUrl(apiUrl), ip, disableTls };
  } catch (error) {
    return error instanceof Error ? error.message : "Adres API Claroty jest nieprawidłowy.";
  }
}

export async function getClarotyDeviceDetails(request: ClarotyRequest): Promise<{
  apiUrl: string;
  payload: unknown;
  devices: unknown[];
}> {
  // The API User identifies the Claroty service account that owns the token.
  // Claroty authorizes this request with the token itself, so the API User is
  // deliberately not sent as a guessed, non-standard HTTP header.
  const { apiUser: _apiUser, token } = getClarotyCredentials();
  const response = await fetch(appendPath(request.apiUrl, "/api/v1/devices/"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "ExtremePolicyManager/1.0",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      offset: 0,
      limit: 100,
      include_count: true,
      fields: CLAROTY_DEVICE_FIELDS,
      filter_by: { field: "ip_list", operation: "in", value: [request.ip] },
    }),
    ...(request.disableTls ? { tls: { rejectUnauthorized: false } } : {}),
  });
  const payload = await readResponse(response);
  if (!response.ok) {
    const message = response.status === 403
      ? "Claroty odrzuciło żądanie (403). Sprawdź, czy CLAROTY_API_URL wskazuje na host API, a API User ma uprawnienia Read-Only do urządzeń i właściwych site'ów."
      : responseMessage(payload, response.statusText);
    throw new ClarotyApiError(
      `Nie udało się pobrać danych urządzenia z Claroty: ${message}.`,
      response.status,
    );
  }

  return { apiUrl: request.apiUrl, payload, devices: extractDevices(payload) };
}
