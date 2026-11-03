import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { appManifest } from "./manifest.js";
import { readBearer, verifySessionToken } from "./session-tokens.js";
import { verifyWebhook } from "./webhook-signatures.js";

/**
 * The whole app on Node's own http module:
 *
 *   GET  /lintel-app.json   what Lintel reads when someone adds the app
 *   GET  /admin/page        the page shown inside the Lintel admin
 *   GET  /assets/*          the page's script and styles, and @lintel/app-bridge
 *   GET  /api/hello         for the page, with a session token this server checks
 *   POST /webhooks          events from Lintel, checked against their signature
 */
const publicFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const MAXIMUM_BODY_BYTES = 1024 * 1024;
const KEPT_EVENTS = 20;

const contentTypes = {
  ".js": "text/javascript; charset=utf-8",
  ".map": "application/json",
  ".css": "text/css; charset=utf-8",
};

const notInstalledMessage =
  "Install the app in Lintel first, then put LINTEL_CLIENT_ID and LINTEL_CLIENT_SECRET in .env.";

/** @param {import("./config.js").AppConfig} config */
export function createAppServer(config) {
  /** What was published lately, newest first. In memory: a real app keeps its own database. */
  const published = [];

  function installedCredentials() {
    return config.clientId && config.clientSecret
      ? { clientId: config.clientId, clientSecret: config.clientSecret }
      : undefined;
  }

  /**
   * The page shell. frame-ancestors lets only the Lintel admin show it, so no other site
   * can frame the app and trick someone into clicking in it.
   */
  function sendPage(response) {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
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
    <title>__APP_NAME__</title>
    <link rel="stylesheet" href="/assets/style.css" />
    <script type="module" src="/assets/page.js"></script>
  </head>
  <body>
    <main id="app" aria-live="polite"><p class="quiet">Loading…</p></main>
  </body>
</html>`);
  }

  /** The page asks this with a fresh session token; nothing is trusted until it checks out. */
  async function sayHello(request, response) {
    const credentials = installedCredentials();
    if (!credentials) return sendJson(response, 503, { message: notInstalledMessage });
    const token = readBearer(request.headers.authorization);
    const session = token && verifySessionToken(token, credentials);
    if (!session) {
      return sendJson(response, 401, { message: "The session token is missing or not valid" });
    }
    sendJson(response, 200, {
      permissions: session.permissions,
      published,
      collections: await countCollections(credentials.clientSecret),
    });
  }

  async function receiveWebhook(request, response) {
    const credentials = installedCredentials();
    if (!credentials) return sendJson(response, 503, { message: notInstalledMessage });
    const body = await readBody(request);
    const signature = request.headers["lintel-signature"];
    const header = typeof signature === "string" ? signature : undefined;
    if (!verifyWebhook(body, header, credentials.clientSecret)) {
      return sendJson(response, 401, { message: "The signature doesn't match" });
    }
    const event = JSON.parse(body);
    published.unshift({
      title: String(event.data?.entry?.title ?? "Untitled"),
      at: typeof event.occurredAt === "string" ? event.occurredAt : new Date().toISOString(),
    });
    published.length = Math.min(published.length, KEPT_EVENTS);
    response.writeHead(204).end();
  }

  /** The app calling Lintel with its client secret. It gets what its scopes allow, no more. */
  async function countCollections(clientSecret) {
    try {
      const answer = await fetch(`${config.lintelApiUrl}/collections`, {
        headers: { authorization: `Bearer ${clientSecret}` },
        signal: AbortSignal.timeout(3_000),
      });
      if (!answer.ok) return null;
      const { collections } = await answer.json();
      return Array.isArray(collections) ? collections.length : null;
    } catch {
      return null;
    }
  }

  async function handle(request, response) {
    const url = new URL(request.url ?? "/", config.appUrl);
    const route = `${request.method} ${url.pathname}`;

    if (route === "GET /lintel-app.json") return sendJson(response, 200, appManifest(config));
    if (route === "GET /admin/page") return sendPage(response);
    if (request.method === "GET" && url.pathname.startsWith("/assets/")) {
      return sendAsset(response, url.pathname.slice("/assets/".length));
    }
    if (route === "GET /api/hello") return sayHello(request, response);
    if (route === "POST /webhooks") return receiveWebhook(request, response);
    sendJson(response, 404, { message: "Not found" });
  }

  return createServer((request, response) => {
    handle(request, response).catch((error) => {
      console.error(error);
      if (!response.headersSent) sendJson(response, 500, { message: "Something went wrong" });
    });
  });
}

async function sendAsset(response, name) {
  // Plain file names only, so nothing like "../" can reach outside the two folders.
  const bridgeFile = name.match(/^app-bridge\/([\w-]+\.js(?:\.map)?)$/)?.[1];
  const ownFile = name.match(/^([\w-]+\.(?:js|css))$/)?.[1];
  const path = bridgeFile
    ? join(bridgeFolder(), bridgeFile)
    : ownFile && join(publicFolder, ownFile);
  if (!path) return sendJson(response, 404, { message: "Not found" });
  try {
    const content = await readFile(path);
    response.writeHead(200, {
      "content-type": contentTypes[path.slice(path.lastIndexOf("."))] ?? "application/octet-stream",
      "x-content-type-options": "nosniff",
    });
    response.end(content);
  } catch {
    sendJson(response, 404, { message: "Not found" });
  }
}

/** The bridge's built files, served as they are: no bundler needed. Found after npm install. */
function bridgeFolder() {
  const packageFile = createRequire(import.meta.url).resolve("@lintel/app-bridge/package.json");
  return join(dirname(packageFile), "dist");
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
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

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}
