import websocket from "@fastify/websocket";
import type { FastifyInstance } from "fastify";
import { CollaborationHub } from "./collaboration-hub.js";
import { liveLimits } from "./live-limits.js";

declare module "fastify" {
  interface FastifyInstance {
    /** Who is connected and on which page (see src/collaboration). */
    collaboration: CollaborationHub;
  }
}

/** The live connection's parts that belong to the server as a whole. */
export function registerCollaboration(server: FastifyInstance): void {
  server.register(websocket, { options: { maxPayload: liveLimits.maxMessageBytes } });
  const hub = new CollaborationHub({ database: () => server.database, log: server.log });
  server.decorate("collaboration", hub);
  server.addHook("preClose", async () => hub.close());
}
