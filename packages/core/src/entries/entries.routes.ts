import type { FastifyInstance, FastifyRequest } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { announceContentEvent } from "../content-events/content-events.js";
import { describeEntryForEvent } from "../content-events/entry-event-data.js";
import { parseRequest } from "../http/http-errors.js";
import { EntryNotFoundError } from "./entries.errors.js";
import { requireEntryPermission } from "./entry-access.js";
import { duplicateEntry } from "./entry-duplication.service.js";
import { listEntries } from "./entry-listing.service.js";
import { reorderEntries } from "./entry-ordering.service.js";
import { publishEntry, scheduleEntry, unpublishEntry } from "./entry-publishing.service.js";
import {
  collectionEntriesParamsSchema,
  createEntryRequestSchema,
  entryIdParamsSchema,
  listEntriesQuerySchema,
  reorderEntriesRequestSchema,
  scheduleEntryRequestSchema,
  updateEntryRequestSchema,
} from "./entries.schema.js";
import {
  createEntry,
  deleteEntry,
  type EntryChangeContext,
  findEntry,
  saveEntry,
} from "./entries.service.js";

/**
 * HTTP only:
 *
 *   GET    /collections/:handle/entries          (entries:read)     ?status&search&page&perPage&parentId
 *   POST   /collections/:handle/entries          (entries:create)   { data, slug?, parentId? } -> 201
 *   POST   /collections/:handle/entries/reorder  (entries:update)   { order: [{ id, parentId }] } -> 204
 *   GET    /entries/:id                          (entries:read)
 *   PATCH  /entries/:id                          (entries:update)   { data?, slug?, parentId? }
 *   POST   /entries/:id/publish                  (entries:publish)
 *   POST   /entries/:id/unpublish                (entries:publish)
 *   POST   /entries/:id/schedule                 (entries:publish)  { publishAt }
 *   DELETE /entries/:id                          (entries:delete)   -> 204
 *
 * Changing, publishing and deleting one entry also accept the "-own" permission
 * (`entries:update-own` and so on) for entries the person created; see entry-access.ts.
 *   POST   /entries/:id/duplicate                (entries:create)   -> 201, a draft copy
 */
export async function entriesRoutes(server: FastifyInstance) {
  const can = (permission: `entries:${string}`) => ({ preHandler: requirePermission(permission) });
  const canOnThisEntry = (action: "update" | "publish" | "delete") => ({
    preHandler: requireEntryPermission(action),
  });

  server.get("/collections/:handle/entries", can("entries:read"), async (request) => {
    const { handle } = parseRequest(collectionEntriesParamsSchema, request.params);
    const query = parseRequest(listEntriesQuerySchema, request.query);
    return listEntries(server.database, handle, query);
  });

  server.post("/collections/:handle/entries", can("entries:create"), async (request, reply) => {
    const { handle } = parseRequest(collectionEntriesParamsSchema, request.params);
    const entry = parseRequest(createEntryRequestSchema, request.body);
    const created = await createEntry(server.database, handle, entry, changeContext(request));
    return reply.code(201).send(created);
  });

  server.post(
    "/collections/:handle/entries/reorder",
    can("entries:update"),
    async (request, reply) => {
      const { handle } = parseRequest(collectionEntriesParamsSchema, request.params);
      const order = parseRequest(reorderEntriesRequestSchema, request.body);
      await reorderEntries(server.database, handle, order);
      return reply.code(204).send();
    },
  );

  server.get("/entries/:id", can("entries:read"), async (request) => {
    const id = readEntryId(request.params);
    return findEntry(server.database, id);
  });

  server.patch("/entries/:id", canOnThisEntry("update"), async (request) => {
    const id = readEntryId(request.params);
    const changes = parseRequest(updateEntryRequestSchema, request.body);
    // Only a new slug or parent can move an entry, so only then is its old address needed.
    const mayMove = changes.slug !== undefined || changes.parentId !== undefined;
    const before = mayMove ? await describeEntryForEvent(server.database, id) : undefined;
    const saved = await saveEntry(server.database, id, changes, changeContext(request));
    if (before?.url && before.publishedAt !== null) {
      const after = await describeEntryForEvent(server.database, id);
      if (after.url && after.url !== before.url) {
        await announceContentEvent(server, {
          name: "entry.moved",
          entry: after,
          previousUrl: before.url,
        });
      }
    }
    return saved;
  });

  server.post("/entries/:id/publish", canOnThisEntry("publish"), async (request) => {
    const id = readEntryId(request.params);
    const published = await publishEntry(server.database, id, changeContext(request));
    const entry = await describeEntryForEvent(server.database, id);
    await announceContentEvent(server, { name: "entry.published", entry });
    return published;
  });

  server.post("/entries/:id/unpublish", canOnThisEntry("publish"), async (request) => {
    const id = readEntryId(request.params);
    const unpublished = await unpublishEntry(server.database, id, getSignedIn(request).user.id);
    const entry = await describeEntryForEvent(server.database, id);
    await announceContentEvent(server, { name: "entry.unpublished", entry });
    return unpublished;
  });

  server.post("/entries/:id/schedule", canOnThisEntry("publish"), async (request) => {
    const id = readEntryId(request.params);
    const { publishAt } = parseRequest(scheduleEntryRequestSchema, request.body);
    return scheduleEntry(server.database, id, publishAt, changeContext(request));
  });

  server.post("/entries/:id/duplicate", can("entries:create"), async (request, reply) => {
    const id = readEntryId(request.params);
    const copy = await duplicateEntry(server.database, id, changeContext(request));
    return reply.code(201).send(copy);
  });

  server.delete("/entries/:id", canOnThisEntry("delete"), async (request, reply) => {
    const id = readEntryId(request.params);
    const entry = await describeEntryForEvent(server.database, id);
    await deleteEntry(server.database, id);
    await announceContentEvent(server, { name: "entry.deleted", entry });
    return reply.code(204).send();
  });
}

/** The entry id from the path; one that isn't a uuid is simply not found. */
export function readEntryId(params: unknown): string {
  const parsed = entryIdParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new EntryNotFoundError();
  }
  return parsed.data.id;
}

/** Who is saving, and how to check that the images they picked exist. */
export function changeContext(request: FastifyRequest): EntryChangeContext {
  return { authorId: getSignedIn(request).user.id, assetExists: request.server.assetExists };
}
