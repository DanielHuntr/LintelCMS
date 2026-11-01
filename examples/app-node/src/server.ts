import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type AppConfig, appManifest } from "./config.js";
import { PublishingLog } from "./publishing-log.js";
import { readBearer, verifySessionToken } from "./session-tokens.js";
import { verifyWebhook } from "./webhook-signatures.js";

/**
 * The whole app on Node's own `http` module, so every step is visible:
 *
 *   GET  /lintel-app.json   what Lintel reads when someone adds the app
 *   GET  /admin/*           the pages shown inside the Lintel admin (one shell, see public/page.js)
 *   GET  /assets/*          the page's script, styles and icon, and @lintel/app-bridge
 *   GET  /api/log           the log, for a page that sends a valid session token
 *   POST /webhooks          events from Lintel, checked against their signature
 */
const publicFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
// The bridge's built files, served as they are: no bundler needed in the app.
const bridgeFolder = join(
  dirname(createRequire(import.meta.url).resolve("@lintel/app-bridge/package.json")),
  "dist",
);
const ADMIN_PAGES = new Set(["/admin/log", "/admin/widget", "/admin/panel", "/admin/settings"]);
const MAXIMUM_BODY_BYTES = 1024 * 1024;

const contentTypes: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".map": "application/json",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};

export function createAppServer(config: AppConfig, log = new PublishingLog()): Server {
  return createServer((request, response) => {
    handle(request, response, config, log).catch((error: unknown) => {
      console.error(error);
      if (!response.headersSent) sendJson(response, 500, { message: "Something went wrong" });
    });
  });
}

async function handle(
  request: IncomingMessage,
  response: ServerResponse,
  config: AppConfig,
  log: PublishingLog,
): Promise<void> {
  const url = new URL(request.url ?? "/", config.appUrl);

  if (request.method === "GET" && url.pathname === "/lintel-app.json") {
    return sendJson(response, 200, appManifest(config));
  }
  if (request.method === "GET" && ADMIN_PAGES.has(url.pathname)) {
    return sendPage(response, config);
  }
  if (request.method === "GET" && url.pathname.startsWith("/assets/")) {
    return sendAsset(response, url.pathname.slice("/assets/".length));
  }
  if (request.method === "GET" && url.pathname === "/api/log") {
    return sendLog(request, response, url, config, log);
  }
  if (request.method === "POST" && url.pathname === "/webhooks") {
    return receiveWebhook(request, response, config, log);
  }
  sendJson(response, 404, { message: "Not found" });
}

/**
 * The page shell. `frame-ancestors` lets only the Lintel admin embed it, so another site
 * can't frame the app and trick someone into clicking in it. Scripts come from this app only.
 */
function sendPage(response: ServerResponse, config: AppConfig): void {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self'",
      "script-src 'self'",
      "connect-src 'self'",
      `frame-ancestors ${config.lintelAdminOrigin}`,
    ].join("; "),
    "x-content-type-options": "nosniff",
  });
  response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Publishing Log</title>
    <link rel="stylesheet" href="/assets/style.css" />
    <script type="module" src="/assets/page.js"></script>
  </head>
  <body>
    <main id="app" aria-live="polite"><p class="quiet">Loading…</p></main>
  </body>
</html>`);
}

async function sendAsset(response: ServerResponse, name: string): Promise<void> {
  // Only plain file names: nothing like "../" can reach outside the two folders.
  const bridgeFile = name.match(/^app-bridge\/([\w-]+\.js(?:\.map)?)$/)?.[1];
  const ownFile = name.match(/^([\w-]+\.(?:js|css|svg))$/)?.[1];
  const path = bridgeFile ? join(bridgeFolder, bridgeFile) : ownFile && join(publicFolder, ownFile);
  if (!path) {
    return sendJson(response, 404, { message: "Not found" });
  }
  try {
    const content = await readFile(path);
    const extension = path.slice(path.lastIndexOf("."));
    response.writeHead(200, {
      "content-type": contentTypes[extension] ?? "application/octet-stream",
      "x-content-type-options": "nosniff",
    });
    response.end(content);
  } catch {
    sendJson(response, 404, { message: "Not found" });
  }
}

/** The page's own API: it trusts nothing until the session token checks out. */
async function sendLog(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  config: AppConfig,
  log: PublishingLog,
): Promise<void> {
  const credentials = installedCredentials(config);
  if (!credentials) {
    return sendJson(response, 503, { message: notInstalledMessage });
  }
  const token = readBearer(request.headers.authorization);
  const session = token && verifySessionToken(token, credentials);
  if (!session) {
    return sendJson(response, 401, { message: "The session token is missing or not valid" });
  }
  const entryId = url.searchParams.get("entryId");
  sendJson(response, 200, {
    you: { userId: session.userId, permissions: session.permissions },
    events: log.recent(entryId ?? undefined),
    collectionCount: await countCollections(config, credentials.clientSecret),
  });
}

async function receiveWebhook(
  request: IncomingMessage,
  response: ServerResponse,
  config: AppConfig,
  log: PublishingLog,
): Promise<void> {
  const credentials = installedCredentials(config);
  if (!credentials) {
    return sendJson(response, 503, { message: notInstalledMessage });
  }
  const body = await readBody(request);
  const signature = request.headers["lintel-signature"];
  if (
    !verifyWebhook(
      body,
      typeof signature === "string" ? signature : undefined,
      credentials.clientSecret,
    )
  ) {
    return sendJson(response, 401, { message: "The signature doesn't match" });
  }
  log.record(JSON.parse(body) as unknown);
  response.writeHead(204).end();
}

/**
 * The app calling Lintel's API with its client secret. It gets what its scopes allow, no
 * more; here, reading the content model.
 */
async function countCollections(config: AppConfig, clientSecret: string): Promise<number | null> {
  try {
    const response = await fetch(new URL("/collections", config.lintelApiUrl), {
      headers: { authorization: `Bearer ${clientSecret}` },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { collections?: unknown[] };
    return body.collections?.length ?? null;
  } catch {
    return null;
  }
}

const notInstalledMessage =
  "Install the app in Lintel first, then set LINTEL_CLIENT_ID and LINTEL_CLIENT_SECRET.";

function installedCredentials(config: AppConfig) {
  return config.clientId && config.clientSecret
    ? { clientId: config.clientId, clientSecret: config.clientSecret }
    : undefined;
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAXIMUM_BODY_BYTES) {
        request.destroy();
        reject(new Error("The request body is too big"));
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}
