import type { FastifyInstance, FastifyRequest } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { announceContentEvent } from "../content-events/content-events.js";
import { describeEntryForEvent } from "../content-events/entry-event-data.js";
import { actorOf } from "../events/event-actor.js";
import { parseRequest } from "../http/http-errors.js";
import { EntryNotFoundError } from "./entries.errors.js";
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
  findEntryOrFail,
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
 *   POST   /entries/:id/duplicate                (entries:create)   -> 201, a draft copy
 */
export async function entriesRoutes(server: FastifyInstance) {
  const can = (permission: `entries:${string}`) => ({ preHandler: requirePermission(permission) });

  server.get("/collections/:handle/entries", can("entries:read"), async (request) => {
    const { handle } = parseRequest(collectionEntriesParamsSchema, request.params);
    const query = parseRequest(listEntriesQuerySchema, request.query);
    return listEntries(server.database, handle, query);
  });

  server.post("/collections/:handle/entries", can("entries:create"), async (request, reply) => {
    const { handle } = parseRequest(collectionEntriesParamsSchema, request.params);
    const entry = parseRequest(createEntryRequestSchema, request.body);
    const created = await createEntry(server.database, handle, entry, changeContext(request));
    const createdEntry = await describeEntryForEvent(server.database, created.id);
    await announceContentEvent(
      server,
      { name: "entry.created", entry: createdEntry },
      actorOf(request),
    );
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

  server.patch("/entries/:id", can("entries:update"), async (request) => {
    const id = readEntryId(request.params);
    const changes = parseRequest(updateEntryRequestSchema, request.body);
    const before = await describeEntryForEvent(server.database, id);
    const beforeValues = await findEntryOrFail(server.database, id);
    const saved = await saveEntry(server.database, id, changes, changeContext(request));
    const after = await describeEntryForEvent(server.database, id);
    const changedFields = listChangedFields(beforeValues, saved);
    if (changedFields.length > 0) {
      await announceContentEvent(
        server,
        { name: "entry.updated", entry: after, changedFields },
        actorOf(request),
      );
    }
    // Only a live entry has an old address worth redirecting from.
    if (before.url && before.publishedAt !== null && after.url && after.url !== before.url) {
      await announceContentEvent(
        server,
        { name: "entry.moved", entry: after, previousUrl: before.url },
        actorOf(request),
      );
    }
    return saved;
  });

  server.post("/entries/:id/publish", can("entries:publish"), async (request) => {
    const id = readEntryId(request.params);
    await checkMayPublish(request, id);
    const published = await publishEntry(server.database, id, changeContext(request));
    const entry = await describeEntryForEvent(server.database, id);
    await announceContentEvent(server, { name: "entry.published", entry }, actorOf(request));
    return published;
  });

  server.post("/entries/:id/unpublish", can("entries:publish"), async (request) => {
    const id = readEntryId(request.params);
    const unpublished = await unpublishEntry(server.database, id, getSignedIn(request).user.id);
    const entry = await describeEntryForEvent(server.database, id);
    await announceContentEvent(server, { name: "entry.unpublished", entry }, actorOf(request));
    return unpublished;
  });

  server.post("/entries/:id/schedule", can("entries:publish"), async (request) => {
    const id = readEntryId(request.params);
    const { publishAt } = parseRequest(scheduleEntryRequestSchema, request.body);
    await checkMayPublish(request, id);
    return scheduleEntry(server.database, id, publishAt, changeContext(request));
  });

  server.post("/entries/:id/duplicate", can("entries:create"), async (request, reply) => {
    const id = readEntryId(request.params);
    const copy = await duplicateEntry(server.database, id, changeContext(request));
    return reply.code(201).send(copy);
  });

  server.delete("/entries/:id", can("entries:delete"), async (request, reply) => {
    const id = readEntryId(request.params);
    const entry = await describeEntryForEvent(server.database, id);
    await deleteEntry(server.database, id);
    await announceContentEvent(server, { name: "entry.deleted", entry }, actorOf(request));
    return reply.code(204).send();
  });
}

/**
 * Asks the features that may refuse a publish (such as content approval in
 * src/workflows) before an entry goes live or is scheduled to.
 */
async function checkMayPublish(request: FastifyRequest, entryId: string): Promise<void> {
  const entry = await describeEntryForEvent(request.server.database, entryId);
  await request.server.events.runChecks("entry.publishing", {
    entry,
    actor: actorOf(request),
    permissions: getSignedIn(request).permissions,
  });
}

/** The fields whose saved values differ, plus "slug" and "parent" when those moved. */
function listChangedFields(
  before: { data: Record<string, unknown>; slug: string; parentId: string | null },
  after: { data: Record<string, unknown>; slug: string; parentId: string | null },
): string[] {
  const handles = new Set([...Object.keys(before.data), ...Object.keys(after.data)]);
  const changed = [...handles].filter(
    (handle) => JSON.stringify(before.data[handle]) !== JSON.stringify(after.data[handle]),
  );
  if (before.slug !== after.slug) changed.push("slug");
  if (before.parentId !== after.parentId) changed.push("parent");
  return changed;
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
