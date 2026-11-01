/**
 * Where the admin is and where the API is. In development these come from Vite (the API on
 * http://localhost:4000, the admin at /). In production the server says, in a
 * `lintel-admin` meta tag it adds to index.html, so one build works at any address and
 * under any path (see packages/core/src/production/admin-app.ts).
 */
export interface RuntimeSettings {
  /** The path the admin is served under, such as "/admin"; "/" in development. */
  basePath: string;
  /** The API's full address, with no trailing slash. */
  apiUrl: string;
}

const DEVELOPMENT_API_URL = "http://localhost:4000";

export function readRuntimeSettings(
  document: Pick<Document, "querySelector"> | undefined = globalThis.document,
  pageOrigin: string | undefined = globalThis.location?.origin,
  buildApiUrl: string | undefined = import.meta.env.VITE_API_URL,
): RuntimeSettings {
  const fromServer = readServerSettings(document);
  const apiUrl = fromServer.apiUrl ?? buildApiUrl ?? DEVELOPMENT_API_URL;
  return {
    basePath: fromServer.basePath ?? "/",
    // The server says "/api" when the API is on the same address as the admin.
    apiUrl: absoluteUrl(apiUrl, pageOrigin).replace(/\/+$/, ""),
  };
}

function readServerSettings(document: Pick<Document, "querySelector"> | undefined): {
  basePath?: string;
  apiUrl?: string;
} {
  const content = document?.querySelector('meta[name="lintel-admin"]')?.getAttribute("content");
  if (!content) return {};
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== "object" || parsed === null) return {};
    const settings = parsed as Record<string, unknown>;
    return {
      ...(typeof settings.basePath === "string" ? { basePath: settings.basePath } : {}),
      ...(typeof settings.apiUrl === "string" ? { apiUrl: settings.apiUrl } : {}),
    };
  } catch {
    return {};
  }
}

function absoluteUrl(url: string, pageOrigin: string | undefined): string {
  if (!url.startsWith("/") || !pageOrigin) return url;
  return new URL(url, pageOrigin).toString();
}

export const runtimeSettings = readRuntimeSettings();
