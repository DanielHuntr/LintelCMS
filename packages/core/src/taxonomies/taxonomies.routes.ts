import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { resolveDeliverySite, resolveEditingSite } from "../sites/request-site.js";
import { deliverTaxonomy, deliverTermBySlug } from "./taxonomies-delivery.service.js";
import { TermNotFoundError } from "./taxonomies.errors.js";
import {
  createTaxonomyRequestSchema,
  createTermRequestSchema,
  taxonomyHandleParamsSchema,
  termIdParamsSchema,
  termSlugParamsSchema,
  updateTaxonomyRequestSchema,
  updateTermRequestSchema,
} from "./taxonomies.schema.js";
import {
  createTaxonomy,
  deleteTaxonomy,
  findTaxonomy,
  listTaxonomies,
  updateTaxonomy,
} from "./taxonomies.service.js";
import { createTerm, deleteTerm, listTerms, updateTerm } from "./terms.service.js";

/**
 * HTTP only:
 *
 *   GET    /taxonomies                (taxonomies:read)    -> { taxonomies: [Taxonomy] }
 *   GET    /taxonomies/:handle        (taxonomies:read)    -> Taxonomy
 *   POST   /taxonomies                (taxonomies:update)  { handle, name } -> 201 Taxonomy
 *   PUT    /taxonomies/:handle        (taxonomies:update)  { name } -> Taxonomy
 *   DELETE /taxonomies/:handle        (taxonomies:update)  -> 204, or 409 TAXONOMY_IN_USE
 *   GET    /taxonomies/:handle/terms  (taxonomies:read)    -> { terms: [Term] }
 *   POST   /taxonomies/:handle/terms  (terms:update)       { title, slug?, description? } -> 201
 *   PATCH  /terms/:id                 (terms:update)       { title?, slug?, description? }
 *   DELETE /terms/:id                 (terms:update)       -> 204
 *   GET    /delivery/taxonomies/:handle        (public)  -> { handle, name, items: [Term] }
 *   GET    /delivery/taxonomies/:handle/:slug  (public)  -> Term, or 404
 *
 * Lists and lookups see the taxonomies every site shares and the current site's own.
 */
export async function taxonomiesRoutes(server: FastifyInstance) {
  const canRead = { preHandler: requirePermission("taxonomies:read") };
  const canUpdate = { preHandler: requirePermission("taxonomies:update") };
  const canUpdateTerms = { preHandler: requirePermission("terms:update") };

  server.get("/taxonomies", canRead, async (request) =>
    listTaxonomies(server.database, await resolveEditingSite(request)),
  );

  server.get("/taxonomies/:handle", canRead, async (request) => {
    const { handle } = parseRequest(taxonomyHandleParamsSchema, request.params);
    return findTaxonomy(server.database, handle, await resolveEditingSite(request));
  });

  server.post("/taxonomies", canUpdate, async (request, reply) => {
    const taxonomy = parseRequest(createTaxonomyRequestSchema, request.body);
    return reply.code(201).send(await createTaxonomy(server.database, taxonomy));
  });

  server.put("/taxonomies/:handle", canUpdate, async (request) => {
    const { handle } = parseRequest(taxonomyHandleParamsSchema, request.params);
    const changes = parseRequest(updateTaxonomyRequestSchema, request.body);
    return updateTaxonomy(server.database, handle, changes, await resolveEditingSite(request));
  });

  server.delete("/taxonomies/:handle", canUpdate, async (request, reply) => {
    const { handle } = parseRequest(taxonomyHandleParamsSchema, request.params);
    await deleteTaxonomy(server.database, handle, await resolveEditingSite(request));
    return reply.code(204).send();
  });

  server.get("/taxonomies/:handle/terms", canRead, async (request) => {
    const { handle } = parseRequest(taxonomyHandleParamsSchema, request.params);
    return listTerms(server.database, handle);
  });

  server.post("/taxonomies/:handle/terms", canUpdateTerms, async (request, reply) => {
    const { handle } = parseRequest(taxonomyHandleParamsSchema, request.params);
    const term = parseRequest(createTermRequestSchema, request.body);
    return reply.code(201).send(await createTerm(server.database, handle, term));
  });

  server.patch("/terms/:id", canUpdateTerms, async (request) => {
    const id = readTermId(request.params);
    const changes = parseRequest(updateTermRequestSchema, request.body);
    return updateTerm(server.database, id, changes);
  });

  server.delete("/terms/:id", canUpdateTerms, async (request, reply) => {
    const id = readTermId(request.params);
    await deleteTerm(server.database, id);
    return reply.code(204).send();
  });

  server.get("/delivery/taxonomies/:handle", async (request, reply) => {
    const { handle } = parseRequest(taxonomyHandleParamsSchema, request.params);
    const site = await resolveDeliverySite(request, reply);
    const taxonomy = await deliverTaxonomy(server.database, handle, site);
    return reply.header("cache-control", DELIVERY_CACHE_CONTROL).send(taxonomy);
  });

  server.get("/delivery/taxonomies/:handle/:slug", async (request, reply) => {
    const { handle, slug } = parseRequest(termSlugParamsSchema, request.params);
    const site = await resolveDeliverySite(request, reply);
    const term = await deliverTermBySlug(server.database, handle, slug, site);
    return reply.header("cache-control", DELIVERY_CACHE_CONTROL).send(term);
  });
}

/** The same as the rest of the delivery API: a minute in a CDN or browser. */
const DELIVERY_CACHE_CONTROL = "public, max-age=60";

/** The term id from the path; one that isn't a uuid is simply not found. */
function readTermId(params: unknown): string {
  const parsed = termIdParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new TermNotFoundError();
  }
  return parsed.data.id;
}
