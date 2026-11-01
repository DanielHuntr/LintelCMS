import type { FastifyInstance, FastifyRequest } from "fastify";
import { PermissionDeniedError } from "../auth/auth.errors.js";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { announceContentEvent } from "../content-events/content-events.js";
import { describeEntryForEvent } from "../content-events/entry-event-data.js";
import { EntryNotFoundError } from "../entries/entries.errors.js";
import { changeContext } from "../entries/entries.routes.js";
import { requireEntryPermission } from "../entries/entry-access.js";
import { actorOf } from "../events/event-actor.js";
import { parseRequest } from "../http/http-errors.js";
import type { Permission } from "../roles/permissions.js";
import { hasPermission } from "../roles/permissions.js";
import { moveToRecycleBin } from "../recycle-bin/recycle-bin.service.js";
import {
  duplicateBranch,
  listBranchIds,
  publishEntries,
  summarizeBranches,
  unpublishEntries,
} from "./content-tree-branches.service.js";
import {
  allowedTypesQuerySchema,
  collectionItemsQuerySchema,
  type BatchResult,
  bulkActionRequestSchema,
  bulkSummaryRequestSchema,
  type MoveEntryRequest,
  moveEntryRequestSchema,
  sortChildrenRequestSchema,
  treeChildrenQuerySchema,
  treeEntryParamsSchema,
  treeRootsQuerySchema,
  treeSearchQuerySchema,
  withDescendantsRequestSchema,
} from "./content-tree.schema.js";
import {
  findEntryPath,
  listAllowedTypes,
  listTreeChildren,
  listTreeRoots,
  moveEntry,
  searchTree,
  sortChildren,
} from "./content-tree.service.js";
import { findEntryInfo } from "./entry-info.service.js";
import { listCollectionItems } from "./collection-view.service.js";

/**
 * HTTP only:
 *
 *   GET  /content-tree                            (entries:read)    ?siteId&locale
 *   GET  /content-tree/children                   (entries:read)    ?parentId | ?collection, &offset&limit
 *   GET  /content-tree/search                     (entries:read)    ?search
 *   GET  /content-tree/items                      (entries:read)    ?parentId | ?collection, &search&status&sort&direction&page&perPage
 *   GET  /content-tree/allowed-types              (entries:read)    ?parentId | ?collection
 *   GET  /content-tree/entries/:id/path           (entries:read)
 *   GET  /content-tree/entries/:id/info           (entries:read)
 *   POST /content-tree/move                       (entries:update)  { entryId, parentId, index } -> { previous, addressChanges }
 *   POST /content-tree/sort                       (entries:update)  { parentId, collection?, order }
 *   POST /content-tree/entries/:id/publish        (entries:publish) { includeDescendants }
 *   POST /content-tree/entries/:id/unpublish      (entries:publish) { includeDescendants }
 *   POST /content-tree/entries/:id/duplicate      (entries:create)  { includeDescendants } -> 201
 *   POST /content-tree/entries/:id/recycle        (entries:delete)  -> 201 { itemId, entryIds }
 *   POST /content-tree/bulk                       (depends on the action)
 *   POST /content-tree/bulk/summary               (entries:read)    { entryIds } -> { items, totalCount }
 */
export async function contentTreeRoutes(server: FastifyInstance) {
  const can = (permission: Permission) => ({ preHandler: requirePermission(permission) });

  server.get("/content-tree", can("entries:read"), async (request) =>
    listTreeRoots(server.database, parseRequest(treeRootsQuerySchema, request.query)),
  );

  server.get("/content-tree/children", can("entries:read"), async (request) =>
    listTreeChildren(server.database, parseRequest(treeChildrenQuerySchema, request.query)),
  );

  server.get("/content-tree/search", can("entries:read"), async (request) =>
    searchTree(server.database, parseRequest(treeSearchQuerySchema, request.query)),
  );

  server.get("/content-tree/items", can("entries:read"), async (request) =>
    listCollectionItems(server.database, parseRequest(collectionItemsQuerySchema, request.query)),
  );

  server.get("/content-tree/allowed-types", can("entries:read"), async (request) =>
    listAllowedTypes(server.database, parseRequest(allowedTypesQuerySchema, request.query)),
  );

  server.get("/content-tree/entries/:id/path", can("entries:read"), async (request) =>
    findEntryPath(server.database, readId(request.params)),
  );

  server.get("/content-tree/entries/:id/info", can("entries:read"), async (request) =>
    findEntryInfo(server.database, readId(request.params)),
  );

  server.post("/content-tree/move", can("entries:update"), async (request) =>
    moveAndAnnounce(request, parseRequest(moveEntryRequestSchema, request.body)),
  );

  server.post("/content-tree/sort", can("entries:update"), async (request) =>
    sortChildren(server.database, parseRequest(sortChildrenRequestSchema, request.body)),
  );

  server.post("/content-tree/entries/:id/publish", can("entries:publish"), async (request) => {
    const { includeDescendants } = parseRequest(withDescendantsRequestSchema, request.body ?? {});
    const id = readId(request.params);
    const ids = includeDescendants ? await listBranchIds(server.database, id) : [id];
    return publishAndAnnounce(request, ids);
  });

  server.post("/content-tree/entries/:id/unpublish", can("entries:publish"), async (request) => {
    const { includeDescendants } = parseRequest(withDescendantsRequestSchema, request.body ?? {});
    const id = readId(request.params);
    const ids = includeDescendants ? await listBranchIds(server.database, id) : [id];
    return unpublishAndAnnounce(request, ids);
  });

  server.post(
    "/content-tree/entries/:id/duplicate",
    can("entries:create"),
    async (request, reply) => {
      const { includeDescendants } = parseRequest(withDescendantsRequestSchema, request.body ?? {});
      const result = await duplicateBranch(
        server.database,
        readId(request.params),
        includeDescendants,
        changeContext(request),
      );
      return reply.code(201).send(result);
    },
  );

  server.post(
    "/content-tree/entries/:id/recycle",
    { preHandler: requireEntryPermission("delete") },
    async (request, reply) =>
      reply.code(201).send(await recycleAndAnnounce(request, readId(request.params))),
  );

  server.post("/content-tree/bulk", can("entries:read"), async (request) => {
    const { action, entryIds, parentId } = parseRequest(bulkActionRequestSchema, request.body);
    if (action === "publish") {
      requireToo(request, "entries:publish");
      return publishAndAnnounce(request, entryIds);
    }
    if (action === "unpublish") {
      requireToo(request, "entries:publish");
      return unpublishAndAnnounce(request, entryIds);
    }
    if (action === "move") {
      requireToo(request, "entries:update");
      return moveAll(request, entryIds, parentId ?? null);
    }
    requireToo(request, "entries:delete");
    return recycleAll(request, entryIds);
  });

  server.post("/content-tree/bulk/summary", can("entries:read"), async (request) => {
    const { entryIds } = parseRequest(bulkSummaryRequestSchema, request.body);
    return summarizeBranches(server.database, entryIds);
  });
}

function readId(params: unknown): string {
  return parseRequest(treeEntryParamsSchema, params).id;
}

/** Bulk actions need the permission for what they do, on top of reading content. */
function requireToo(request: FastifyRequest, permission: Permission): void {
  if (!hasPermission(getSignedIn(request).permissions, permission)) {
    throw new PermissionDeniedError(permission);
  }
}

async function publishAndAnnounce(request: FastifyRequest, ids: string[]): Promise<BatchResult> {
  const { database } = request.server;
  const result = await publishEntries(database, ids, changeContext(request), async (entryId) => {
    const entry = await describeEntryForEvent(database, entryId);
    await request.server.events.runChecks("entry.publishing", {
      entry,
      actor: actorOf(request),
      permissions: getSignedIn(request).permissions,
    });
  });
  for (const entryId of result.changed) {
    const entry = await describeEntryForEvent(database, entryId);
    await announceContentEvent(
      request.server,
      { name: "entry.published", entry },
      actorOf(request),
    );
  }
  return result;
}

async function unpublishAndAnnounce(request: FastifyRequest, ids: string[]): Promise<BatchResult> {
  const { database } = request.server;
  const result = await unpublishEntries(database, ids, getSignedIn(request).user.id);
  for (const entryId of result.changed) {
    const entry = await describeEntryForEvent(database, entryId);
    await announceContentEvent(
      request.server,
      { name: "entry.unpublished", entry },
      actorOf(request),
    );
  }
  return result;
}

/**
 * Deletes each picked entry with everything under it, one recycle bin item each, so Undo
 * can restore them all. An entry under another picked one has already gone with it.
 */
async function recycleAll(request: FastifyRequest, entryIds: readonly string[]) {
  const changed: string[] = [];
  const recycleBinItemIds: string[] = [];
  for (const entryId of entryIds) {
    const binned = await recycleAndAnnounce(request, entryId).catch((error: unknown) => {
      if (error instanceof EntryNotFoundError) return undefined;
      throw error;
    });
    if (!binned) continue;
    changed.push(entryId);
    recycleBinItemIds.push(binned.itemId);
  }
  return { changed, skipped: [], recycleBinItemIds } satisfies BatchResult;
}

async function recycleAndAnnounce(request: FastifyRequest, entryId: string) {
  const { database } = request.server;
  const branch = await listBranchIds(database, entryId);
  const described = await Promise.all(branch.map((id) => describeEntryForEvent(database, id)));
  const result = await moveToRecycleBin(database, entryId, getSignedIn(request).user.id);
  for (const entry of described) {
    await announceContentEvent(request.server, { name: "entry.deleted", entry }, actorOf(request));
  }
  return result;
}

/**
 * Moves an entry, then says "entry.moved" for each live page whose address changed, which
 * (with SEO tools on) suggests a redirect from the old address, as a slug change does.
 */
async function moveAndAnnounce(request: FastifyRequest, move: MoveEntryRequest) {
  const { database } = request.server;
  const result = await moveEntry(database, move);
  for (const change of result.addressChanges) {
    const entry = await describeEntryForEvent(database, change.entryId);
    await announceContentEvent(
      request.server,
      { name: "entry.moved", entry, previousUrl: change.from },
      actorOf(request),
    );
  }
  return result;
}

async function moveAll(
  request: FastifyRequest,
  entryIds: string[],
  parentId: string | null,
): Promise<BatchResult> {
  const result: BatchResult = { changed: [], skipped: [] };
  for (const entryId of entryIds) {
    try {
      await moveAndAnnounce(request, { entryId, parentId, index: Number.MAX_SAFE_INTEGER });
      result.changed.push(entryId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const entry = await describeEntryForEvent(request.server.database, entryId).catch(
        () => undefined,
      );
      result.skipped.push({ id: entryId, title: entry?.title ?? "", reason });
    }
  }
  return result;
}
