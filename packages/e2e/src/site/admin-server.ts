import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import {
  createServer,
  request as forwardRequest,
  type IncomingMessage,
  type Server,
} from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize, sep } from "node:path";
import type { ServerResponse } from "node:http";

/**
 * Serves the built admin and passes everything under /api on to the API server, the way
 * a reverse proxy does in production. The admin is built with VITE_API_URL=/api (see
 * admin-build.ts), so one build works for every test site whatever port its API is on.
 *
 * No X-Forwarded-For header is added: the API should see the request as coming from this
 * computer, as it would without the proxy, so first-run setup needs no setup code.
 */

export const API_PREFIX = "/api";

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

export interface AdminServer {
  url: string;
  close: () => Promise<void>;
}

/** `apiPort` is asked for on each request, so the admin can start before the API does. */
export async function startAdminServer(
  adminFolder: string,
  apiPort: () => number,
): Promise<AdminServer> {
  const server = createServer((request, response) => {
    const path = request.url ?? "/";
    if (path === API_PREFIX || path.startsWith(`${API_PREFIX}/`)) {
      passToApi(request, response, apiPort(), path.slice(API_PREFIX.length) || "/");
      return;
    }
    serveAdminFile(adminFolder, path, response).catch((error: unknown) => {
      response.writeHead(500).end(String(error));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://localhost:${port}`, close: () => closeServer(server) };
}

function passToApi(
  incoming: IncomingMessage,
  response: ServerResponse,
  apiPort: number,
  path: string,
): void {
  const headers = { ...incoming.headers, host: `localhost:${apiPort}` };
  const outgoing = forwardRequest(
    { host: "127.0.0.1", port: apiPort, path, method: incoming.method, headers },
    (apiResponse) => {
      response.writeHead(apiResponse.statusCode ?? 502, apiResponse.headers);
      apiResponse.pipe(response);
    },
  );
  outgoing.on("error", (error) => {
    if (!response.headersSent) {
      response.writeHead(502, { "content-type": "text/plain" });
    }
    response.end(`The API could not be reached: ${error.message}`);
  });
  incoming.pipe(outgoing);
}

/** Files that exist are served; every other address gets index.html, for the admin's router. */
async function serveAdminFile(
  adminFolder: string,
  urlPath: string,
  response: ServerResponse,
): Promise<void> {
  const pathname = decodeURIComponent(new URL(urlPath, "http://localhost").pathname);
  const requested = normalize(join(adminFolder, pathname));
  const insideFolder = requested.startsWith(adminFolder + sep);
  const file =
    insideFolder && (await isFile(requested)) ? requested : join(adminFolder, "index.html");
  const isHashedAsset = file.includes(`${sep}assets${sep}`);

  response.writeHead(200, {
    "content-type": contentTypes[extname(file)] ?? "application/octet-stream",
    "cache-control": isHashedAsset ? "public, max-age=31536000, immutable" : "no-cache",
  });
  createReadStream(file).pipe(response);
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function closeServer(server: Server): Promise<void> {
  server.closeAllConnections();
  return new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
