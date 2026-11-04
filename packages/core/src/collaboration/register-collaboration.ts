import websocket from "@fastify/websocket";
import type { FastifyInstance } from "fastify";
import { announceContentEvent } from "../content-events/content-events.js";
import { describeEntryForEvent } from "../content-events/entry-event-data.js";
import { findEntryById } from "../entries/entries.repository.js";
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
  const hub = new CollaborationHub({
    database: () => server.database,
    log: server.log,
    assetExists: () => server.assetExists,
    announceStored: async (entryId, field, author) => {
      const entry = await describeEntryForEvent(server.database, entryId);
      const actor = author && {
        id: author.user.id,
        name: author.user.name,
        email: author.user.email,
      };
      await announceContentEvent(
        server,
        { name: "entry.updated", entry, changedFields: [field] },
        actor,
      );
    },
  });
  server.decorate("collaboration", hub);
  server.addHook("preClose", () => hub.close());
  listenForPageNews(server, hub);
}

const newsOfEvents = {
  "entry.updated": "saved",
  "entry.published": "published",
  "entry.unpublished": "unpublished",
  "entry.deleted": "deleted",
} as const;

/** What happens to entries, from wherever it happens, for the people on those pages. */
function listenForPageNews(server: FastifyInstance, hub: CollaborationHub): void {
  server.events.onEvery("people on the page", async (event) => {
    if (!(event.name in newsOfEvents)) return;
    const data = event.data as { entry: { id: string }; changedFields?: string[] };
    const stored = await findEntryById(server.database, data.entry.id);
    hub.entryChanged(data.entry.id, {
      version: stored?.version ?? 0,
      personId: event.actor?.id ?? null,
      what: newsOfEvents[event.name as keyof typeof newsOfEvents],
      fields: data.changedFields ?? [],
    });
  });
}
