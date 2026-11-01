import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import type { MaintenancePage } from "./supervisor.js";

/**
 * What the site's address answers while the supervisor has stopped the server to switch
 * versions: a short "back in a minute" page for visitors and the admin, 503 for the API and
 * /ready (so load balancers wait), and where the update has got to at
 * `/api/updates/progress`, so the admin's progress screen carries on through the restart.
 * Only the step and its sentence are shown there; nothing private is in them.
 */
export async function openMaintenancePage(options: {
  port: number;
  host: string;
  home: string;
}): Promise<MaintenancePage> {
  const server = createServer((request, response) => {
    void answer(request, response, options.home);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, () => resolve());
  });
  return {
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}

async function answer(request: IncomingMessage, response: ServerResponse, home: string) {
  const path = (request.url ?? "/").split("?")[0] ?? "/";
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Retry-After", "30");

  if (path === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "updating" }));
    return;
  }
  if (path.endsWith("/updates/progress")) {
    const status = await readFile(join(home, "versions", "update-status.json"), "utf8").catch(
      () => "null",
    );
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(`{"progress":${status},"maintenance":true}`);
    return;
  }
  if (path === "/ready" || path.startsWith("/api/")) {
    response.writeHead(503, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({ error: "Lintel is being updated and will be back in a minute." }),
    );
    return;
  }
  response.writeHead(503, { "Content-Type": "text/html; charset=utf-8" });
  response.end(MAINTENANCE_HTML);
}

const MAINTENANCE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="15">
<meta name="robots" content="noindex">
<title>Back in a minute</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: Canvas; color: CanvasText; }
  main { max-width: 32rem; padding: 2rem; text-align: center; }
  h1 { font-size: 1.75rem; margin: 0 0 0.75rem; }
  p { margin: 0; line-height: 1.5; opacity: 0.75; }
</style>
</head>
<body>
<main>
  <h1>Back in a minute</h1>
  <p>This site is being updated. This page will reload by itself when it's ready.</p>
</main>
</body>
</html>
`;
