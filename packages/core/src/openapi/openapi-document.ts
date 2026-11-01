import { z } from "zod";
import type { Operation, OperationResponse } from "./openapi-operations.js";

/**
 * Turns the operation list into an OpenAPI 3.1 document. OpenAPI 3.1 uses JSON Schema
 * itself, so Zod's own `z.toJSONSchema` gives the shapes with nothing in between.
 */
type JsonSchema = Record<string, unknown>;

export interface OpenApiDocument {
  openapi: "3.1.0";
  info: { title: string; version: string; description: string };
  servers: { url: string }[];
  tags: { name: string; description: string }[];
  components: { securitySchemes: Record<string, unknown>; schemas: Record<string, JsonSchema> };
  paths: Record<string, Record<string, unknown>>;
}

const tagDescriptions: Record<Operation["tag"], string> = {
  Delivery: "Published content for websites and apps.",
  SEO: "Search engine details, redirects and the sitemap (with the SEO tools plugin).",
  Collections: "The content model: collections and their content types.",
  Entries: "Creating, editing and publishing entries. Needs an API token or a session.",
  Media: "The media library.",
  Shop: "The storefront: products, carts and checkout (with the Online shop plugin).",
};

const errorSchema: JsonSchema = {
  type: "object",
  description: "Every error has this shape. Branch on `code`; show `message` to people.",
  properties: {
    statusCode: { type: "integer" },
    code: { type: "string", examples: ["NOT_FOUND"] },
    error: { type: "string" },
    message: { type: "string" },
  },
  required: ["statusCode", "code", "message"],
};

export function buildOpenApiDocument(
  operations: readonly Operation[],
  serverUrl: string,
): OpenApiDocument {
  const paths: OpenApiDocument["paths"] = {};
  for (const operation of operations) {
    paths[operation.path] ??= {};
    const pathItem = paths[operation.path] ?? {};
    pathItem[operation.method] = describeOperation(operation);
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Lintel API",
      version: "1",
      description:
        "Read published content, and manage entries and media from your own code. Send an API token as `Authorization: Bearer <token>`; admins make tokens in Settings → API access.",
    },
    servers: [{ url: serverUrl }],
    tags: Object.entries(tagDescriptions).map(([name, description]) => ({ name, description })),
    components: {
      securitySchemes: {
        apiToken: {
          type: "http",
          scheme: "bearer",
          description: "An API token from Settings → API access.",
        },
        session: { type: "apiKey", in: "cookie", name: "__Host-lintel_session" },
      },
      schemas: { Error: errorSchema },
    },
    paths,
  };
}

function describeOperation(operation: Operation): Record<string, unknown> {
  const described: Record<string, unknown> = {
    tags: [operation.tag],
    summary: operation.summary,
    operationId: operationId(operation),
    parameters: [
      ...parametersFrom(operation.params, "path"),
      ...parametersFrom(operation.query, "query"),
    ],
    responses: responsesFor(operation),
  };
  if (operation.description) {
    described.description = operation.description;
  }
  if (operation.access === "public") {
    described.security = [];
  } else if (operation.access === "delivery") {
    // Public unless the site is set to need a token, so both are listed.
    described.security = [{}, { apiToken: [] }];
  } else {
    described.security = [{ apiToken: [] }, { session: [] }];
    described["x-permission"] = operation.access;
  }
  if (operation.body) {
    described.requestBody = {
      required: true,
      content: { "application/json": { schema: toJsonSchema(operation.body, "input") } },
    };
  }
  if (operation.multipartFile) {
    described.requestBody = {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            properties: { file: { type: "string", contentMediaType: "application/octet-stream" } },
            required: ["file"],
          },
        },
      },
    };
  }
  return described;
}

function responsesFor(operation: Operation): Record<string, unknown> {
  const responses: Record<string, unknown> = {};
  for (const [status, response] of Object.entries(operation.responses)) {
    responses[status] = describeResponse(response);
  }
  responses.default = {
    description: "Something went wrong; the message says what.",
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
  };
  return responses;
}

function describeResponse(response: OperationResponse): Record<string, unknown> {
  if (response.schema) {
    return {
      description: response.description,
      content: { "application/json": { schema: toJsonSchema(response.schema, "output") } },
    };
  }
  if (response.contentType) {
    return { description: response.description, content: { [response.contentType]: {} } };
  }
  return { description: response.description };
}

function parametersFrom(schema: z.ZodObject | undefined, location: "path" | "query") {
  if (!schema) {
    return [];
  }
  const json = toJsonSchema(schema, "input");
  const properties = (json.properties ?? {}) as Record<string, JsonSchema>;
  const required = new Set((json.required ?? []) as string[]);
  return Object.entries(properties).map(([name, property]) => ({
    name,
    in: location,
    required: location === "path" || (required.has(name) && property.default === undefined),
    schema: property,
  }));
}

function toJsonSchema(schema: z.ZodType, io: "input" | "output"): JsonSchema {
  const json = z.toJSONSchema(schema, {
    io,
    unrepresentable: "any",
    target: "draft-2020-12",
  }) as JsonSchema;
  // The document as a whole says which JSON Schema it uses; each schema needn't repeat it.
  delete json.$schema;
  return json;
}

/** "GET /delivery/{collection}/{slug}" becomes "getDeliveryCollectionSlug". */
function operationId(operation: Operation): string {
  const words = operation.path
    .split(/[^a-zA-Z0-9]+/)
    .filter((word) => word !== "")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return `${operation.method}${words.join("")}`;
}
