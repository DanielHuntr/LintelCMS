import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { renderServerBlocks } from "./block-rendering.js";
import {
  blockParamsSchema,
  createBlockRequestSchema,
  deleteBlockQuerySchema,
  renderBlocksRequestSchema,
  updateBlockRequestSchema,
} from "./blocks.schema.js";
import {
  createBlock,
  deleteBlock,
  findBlock,
  listBlocks,
  loadBlockLibrary,
  updateBlock,
} from "./blocks.service.js";

/**
 * HTTP only. Anyone who can read entries can see and use the site's blocks; making,
 * changing and deleting them needs `builder:blocks`.
 *
 *   GET    /blocks                 (entries:read)    -> { blocks: [Block] }
 *   POST   /blocks                 (builder:blocks)  { name, icon?, category?, description?,
 *                                                      properties, design } -> 201 Block
 *   GET    /blocks/:handle         (entries:read)    -> Block (with usedOn, usedIn)
 *   PUT    /blocks/:handle         (builder:blocks)  { ..., renamedProperties?, confirmRemovals? }
 *                                                    -> Block, or 409 BLOCK_CHANGE_NEEDS_CONFIRMATION
 *   DELETE /blocks/:handle         (builder:blocks)  ?convert=true -> 204, or 409 BLOCK_IN_USE
 *   POST   /blocks/render          (entries:read)    { instances } -> { html: { [id]: html } }
 */
export async function blocksRoutes(server: FastifyInstance) {
  const canRead = { preHandler: requirePermission("entries:read") };
  const canChange = { preHandler: requirePermission("builder:blocks") };

  server.get("/blocks", canRead, async () => listBlocks(server.database));

  server.post("/blocks", canChange, async (request, reply) => {
    const block = parseRequest(createBlockRequestSchema, request.body);
    return reply.code(201).send(await createBlock(server.database, block));
  });

  server.post("/blocks/render", canRead, async (request) => {
    const { instances } = parseRequest(renderBlocksRequestSchema, request.body);
    const library = Object.fromEntries(
      (await loadBlockLibrary(server.database)).map((block) => [block.handle, block]),
    );
    return { html: await renderServerBlocks(instances, library, server.assetLookup) };
  });

  server.get("/blocks/:handle", canRead, async (request) => {
    const { handle } = parseRequest(blockParamsSchema, request.params);
    return findBlock(server.database, handle);
  });

  server.put("/blocks/:handle", canChange, async (request) => {
    const { handle } = parseRequest(blockParamsSchema, request.params);
    const changes = parseRequest(updateBlockRequestSchema, request.body);
    return updateBlock({ database: server.database }, handle, changes);
  });

  server.delete("/blocks/:handle", canChange, async (request, reply) => {
    const { handle } = parseRequest(blockParamsSchema, request.params);
    const { convert } = parseRequest(deleteBlockQuerySchema, request.query);
    await deleteBlock({ database: server.database, assetLookup: server.assetLookup }, handle, {
      convert: convert === "true",
    });
    return reply.code(204).send();
  });
}
