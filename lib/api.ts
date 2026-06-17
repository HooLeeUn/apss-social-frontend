import { clearToken, getToken } from "./auth";

const DEFAULT_API_PROTOCOL = "http:";
const DEFAULT_API_PORT = "8000";

function resolveDefaultApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return "http://localhost:8000/api";
  }

  const { hostname, protocol } = window.location;
  const apiProtocol = protocol === "https:" ? protocol : DEFAULT_API_PROTOCOL;

  return `${apiProtocol}//${hostname}:${DEFAULT_API_PORT}/api`;
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function resolveConfiguredApiBaseUrl(): string {
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!configuredApiUrl || typeof window === "undefined") {
    return configuredApiUrl || resolveDefaultApiBaseUrl();
  }

  const frontendHostname = window.location.hostname;

  if (isLocalHostname(frontendHostname)) {
    return configuredApiUrl;
  }

  try {
    const configuredUrl = new URL(configuredApiUrl);

    if (isLocalHostname(configuredUrl.hostname)) {
      configuredUrl.hostname = frontendHostname;
      return configuredUrl.toString().replace(/\/$/, "");
    }
  } catch {
    return configuredApiUrl;
  }

  return configuredApiUrl;
}

export const API_BASE_URL = resolveConfiguredApiBaseUrl();

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

function normalizeHeaders(h?: HeadersInit): Record<string, string> {
  if (!h) return {};
  if (h instanceof Headers) return Object.fromEntries(h.entries());
  if (Array.isArray(h)) return Object.fromEntries(h);
  return h;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const normalizedName = name.toLowerCase();
  return Object.keys(headers).some((headerName) => headerName.toLowerCase() === normalizedName);
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const normalizedIncomingHeaders = normalizeHeaders(options.headers);
  const isFormDataBody = typeof FormData !== "undefined" && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...normalizedIncomingHeaders,
  };

  if (!isFormDataBody && !hasHeader(headers, "Content-Type")) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Token ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    const message = text || `HTTP ${res.status}`;

    if (res.status === 401) {
      clearToken();
    }

    throw new ApiError(res.status, message);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;

  return res.json();
}
