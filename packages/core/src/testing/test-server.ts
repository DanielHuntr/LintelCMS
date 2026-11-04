import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from "fastify";
import type { ActiveDatabase } from "../database/active-database.js";
import { emailsSent } from "../email/send-branded-email.js";
import { buildServer, type ServerOptions } from "../server.js";

/**
 * A server for tests, ready for `inject`. Timed jobs are off, so a test decides when
 * scheduled entries are published; pass `runScheduledJobs: true` to test the timer itself.
 */
export async function startTestServer(
  database: ActiveDatabase,
  options: Partial<ServerOptions> = {},
): Promise<FastifyInstance> {
  const server = buildServer({
    adminOrigin: "http://localhost:5173",
    database,
    runScheduledJobs: false,
    ...options,
  });
  // Emails go out after the response. On a server with a pool of connections they can still
  // be on their way when a test looks for them, so tests wait for them here.
  server.addHook("onSend", async () => {
    await emailsSent();
  });
  await server.ready();
  return server;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type SendRequest = (
  method: Method,
  url: string,
  payload?: InjectOptions["payload"],
) => Promise<LightMyRequestResponse>;

/**
 * Sends requests as one signed-in user: `api("POST", "/entries/1/publish")`. `headers` go
 * with every request, such as `{ "lintel-site": "france" }` to work on another site.
 */
export function requestsAs(
  server: FastifyInstance,
  cookies: Record<string, string>,
  headers: Record<string, string> = {},
): SendRequest {
  return (method, url, payload) =>
    server.inject({ method, url, cookies, headers, ...(payload === undefined ? {} : { payload }) });
}
