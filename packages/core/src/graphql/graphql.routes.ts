import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { GraphQLSchema } from "graphql";
import { createYoga, type Plugin } from "graphql-yoga";
import { findRequestApiToken } from "../api-tokens/api-token-auth.js";
import { requireSignedIn } from "../auth/require-permission.js";
import { readSessionToken } from "../auth/session-cookie.js";
import { requireDeliveryAccess } from "../delivery/require-delivery-access.js";
import { hasPermission } from "../roles/permissions.js";
import { queryLimitRules } from "./graphql-limits.js";
import { buildGraphqlSchema } from "./graphql-schema.js";
import { readPreviewToken } from "../preview/preview.service.js";
import { type GraphqlContext, loadContentModel } from "./graphql.service.js";

/**
 * The GraphQL delivery API at /graphql, served by GraphQL Yoga (see
 * docs/decisions/0009-graphql-with-yoga.md). The schema is rebuilt from the blueprints
 * whenever a collection or blueprint changes, and reused until then.
 *
 * Limits keep one request from costing too much: queries may nest at most
 * `MAX_QUERY_DEPTH` levels and ask for about `MAX_QUERY_COST` values at most (see
 * graphql-limits.ts). GraphiQL, the in-browser query editor, is only
 * served in development.
 */
export const MAX_QUERY_DEPTH = 10;
export const MAX_QUERY_COST = 5000;

/** Worked out by Fastify before Yoga runs, so a bad session is an ordinary 401. */
interface ServerContext {
  access: GraphqlContext;
}

export interface GraphqlRoutesOptions {
  graphiql: boolean;
}

export async function graphqlRoutes(server: FastifyInstance, options: GraphqlRoutesOptions) {
  let cached: { version: string; schema: GraphQLSchema } | undefined;

  const limits: Plugin = {
    onValidate({ addValidationRule }) {
      for (const rule of queryLimitRules({ maxDepth: MAX_QUERY_DEPTH, maxCost: MAX_QUERY_COST })) {
        addValidationRule(rule);
      }
    },
  };

  const yoga = createYoga<ServerContext, GraphqlContext>({
    graphqlEndpoint: "/graphql",
    graphiql: options.graphiql ? { title: "Lintel GraphQL" } : false,
    // CORS is decided for the whole server in src/http/cross-origin.ts.
    cors: false,
    landingPage: false,
    logging: false,
    plugins: [limits],
    schema: async () => {
      const model = await loadContentModel(server.database);
      if (cached?.version !== model.version) {
        cached = { version: model.version, schema: buildGraphqlSchema(model) };
      }
      return cached.schema;
    },
    context: ({ access }) => access,
  });

  server.route({
    url: "/graphql",
    method: ["GET", "POST"],
    preHandler: requireDeliveryAccess,
    handler: async (request, reply) => {
      const access = await describeAccess(request, reply);
      const response = await yoga.handleNodeRequestAndResponse(request, reply, { access });
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });
      reply.status(response.status);
      // Responses with a session or a preview in them must never be kept by a shared cache.
      reply.header("cache-control", "no-store");
      return reply.send(response.body);
    },
  });
}

/** What this request may see beyond published content, from its token or session. */
async function describeAccess(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<GraphqlContext> {
  const base = {
    database: request.server.database,
    assetLookup: request.server.assetLookup,
    publicApiUrl: request.server.publicApiUrl,
    previewEntryId: await readPreviewHeader(request),
  };
  const token = await findRequestApiToken(request);
  if (token) {
    const canReadEntries = hasPermission(token.signedIn.permissions, "entries:read");
    return {
      ...base,
      canPreview: token.access === "readWrite" && canReadEntries,
      canListMedia: hasPermission(token.signedIn.permissions, "media:read"),
    };
  }
  if (readSessionToken(request)) {
    await requireSignedIn(request, reply);
    const permissions = request.signedIn?.permissions ?? [];
    return {
      ...base,
      canPreview: hasPermission(permissions, "entries:read"),
      canListMedia: hasPermission(permissions, "media:read"),
    };
  }
  return { ...base, canPreview: false, canListMedia: false };
}

/**
 * A live-preview link's token, sent as the `Lintel-Preview` header (the same token the
 * delivery API takes). A bad or expired token is a 401, as it is there.
 */
async function readPreviewHeader(request: FastifyRequest): Promise<string | undefined> {
  const header = request.headers["lintel-preview"];
  if (typeof header !== "string" || header === "") {
    return undefined;
  }
  return readPreviewToken(request.server.database, header);
}
