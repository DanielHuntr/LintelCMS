/**
 * Reads just enough of an OpenAPI document to list its endpoints on the reference page.
 * Anything the page doesn't show is left alone, so a richer document still works.
 */
export interface OpenApiDocument {
  info: { title: string; description?: string };
  paths: Record<string, Record<string, OpenApiOperation>>;
}

interface OpenApiOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  "x-permission"?: string;
  parameters?: {
    name: string;
    in: string;
    required?: boolean;
    schema?: { type?: string | string[] };
  }[];
  responses?: Record<string, unknown>;
}

export interface ReferenceOperation {
  method: string;
  path: string;
  tag: string;
  summary: string;
  description: string | undefined;
  /** Undefined for endpoints anyone may call. */
  permission: string | undefined;
  parameters: { name: string; in: string; required: boolean; type: string }[];
  responseCodes: string[];
}

const methods = ["get", "post", "put", "patch", "delete"];

export function listOperations(document: OpenApiDocument): ReferenceOperation[] {
  return Object.entries(document.paths).flatMap(([path, pathItem]) =>
    methods.flatMap((method) => {
      const operation = pathItem[method];
      if (!operation) return [];
      return [
        {
          method: method.toUpperCase(),
          path,
          tag: operation.tags?.[0] ?? "Other",
          summary: operation.summary ?? "",
          description: operation.description,
          permission: operation["x-permission"],
          parameters: (operation.parameters ?? []).map((parameter) => ({
            name: parameter.name,
            in: parameter.in,
            required: parameter.required === true,
            type: describeType(parameter.schema?.type),
          })),
          responseCodes: Object.keys(operation.responses ?? {}).filter(
            (code) => code !== "default",
          ),
        },
      ];
    }),
  );
}

function describeType(type: string | string[] | undefined): string {
  if (Array.isArray(type)) return type.join(" or ");
  return type ?? "any";
}
