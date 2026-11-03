import { FontServiceUnreachableError } from "./site-fonts.errors.js";

/**
 * Every request site fonts make to another service goes through here, and only to these
 * hosts. The addresses are built by Lintel from checked ids, never taken from a request,
 * and redirects are refused, so nothing can point the server at its own network.
 *
 * - api.fontsource.org: the list of Google Fonts families, and each family's details.
 * - cdn.jsdelivr.net: the families' WOFF2 files, as published by Fontsource.
 * - use.typekit.net: an Adobe Fonts web project's stylesheet, to list its families.
 */
export const allowedFontHosts = ["api.fontsource.org", "cdn.jsdelivr.net", "use.typekit.net"];

export type FontService = "google" | "adobe";

/** The standard `fetch`, or a stand-in for tests. */
export type FetchFunction = (url: string, init: RequestInit) => Promise<Response>;

export interface FontNetwork {
  /** Text (JSON or CSS), at most `maxBytes`. Null when the service answers 404. */
  readText(url: string, service: FontService, maxBytes: number): Promise<string | null>;
  /** A file's bytes, at most `maxBytes`. Null when the service answers 404. */
  readBytes(url: string, service: FontService, maxBytes: number): Promise<Buffer | null>;
}

const TIMEOUT_MILLISECONDS = 15_000;
const USER_AGENT = "LintelCMS (self-hosted CMS; https://github.com/DanielHuntr/LintelCMS)";

export function createFontNetwork(
  fetchFunction: FetchFunction = (url, init) => fetch(url, init),
  timeoutMilliseconds = TIMEOUT_MILLISECONDS,
): FontNetwork {
  async function read(url: string, service: FontService, maxBytes: number) {
    const address = new URL(url);
    if (address.protocol !== "https:" || !allowedFontHosts.includes(address.hostname)) {
      throw new Error(`Site fonts may not ask ${address.hostname} for anything`);
    }
    let response: Response;
    try {
      response = await fetchFunction(address.toString(), {
        headers: { "user-agent": USER_AGENT },
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMilliseconds),
      });
    } catch {
      throw new FontServiceUnreachableError(service);
    }
    if (response.status === 404) return null;
    if (!response.ok) throw new FontServiceUnreachableError(service);
    if (Number(response.headers.get("content-length") ?? 0) > maxBytes) {
      throw new FontServiceUnreachableError(service);
    }
    return readLimited(response, service, maxBytes);
  }

  return {
    async readText(url, service, maxBytes) {
      const bytes = await read(url, service, maxBytes);
      return bytes === null ? null : bytes.toString("utf8");
    },
    readBytes: read,
  };
}

async function readLimited(
  response: Response,
  service: FontService,
  maxBytes: number,
): Promise<Buffer> {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        await reader.cancel();
        throw new FontServiceUnreachableError(service);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof FontServiceUnreachableError) throw error;
    throw new FontServiceUnreachableError(service);
  }
  return Buffer.concat(chunks);
}
