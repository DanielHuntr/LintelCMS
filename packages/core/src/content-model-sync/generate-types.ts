import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { type ContentModel, type ModelUnit, sortedUnits } from "./content-model.schema.js";
import { labelFromHandle } from "./field-helpers.js";

/**
 * `model types`: TypeScript types for what the delivery API sends for every content type
 * and global set, and a small typed client, in one file with no imports so it can be
 * copied into any website. A content type `post` used by the collection `posts` gives
 *
 *   export interface PostData { title: string; excerpt: string | null; ... }
 *   const post = await lintel.getEntry("posts", "hello-world"); // post.data is PostData
 *
 * Required fields aren't null: publishing checks them. Everything else can be.
 */

interface StoredBlockType {
  handle: string;
  name: string;
  fields: FieldDefinition[];
}

export function generateModelTypes(model: ContentModel): string {
  const writer = new TypesWriter();
  for (const unit of sortedUnits(model)) {
    if (unit.kind === "contentType" || unit.kind === "globalSet") {
      writer.writeDataInterface(unit);
    }
  }
  return (
    [HEADER, SHARED_TYPES, writer.declarations.join("\n\n"), writer.handleMaps(model), CLIENT].join(
      "\n\n",
    ) + "\n"
  );
}

class TypesWriter {
  readonly declarations: string[] = [];
  private readonly names = new Set(RESERVED_NAMES);
  /** The data interface of each content type and global set, by `kind:handle`. */
  readonly dataNames = new Map<string, string>();

  writeDataInterface(unit: Extract<ModelUnit, { kind: "contentType" | "globalSet" }>): void {
    const base = pascalCase(unit.handle);
    const name = this.claim(
      `${base}Data`,
      unit.kind === "globalSet" ? `${base}GlobalSetData` : `${base}ContentTypeData`,
    );
    this.dataNames.set(`${unit.kind}:${unit.handle}`, name);
    const usedBy =
      unit.kind === "contentType" && unit.collections.length > 0
        ? `, used by ${unit.collections.map((collection) => `${collection.name} (\`${collection.handle}\`)`).join(" and ")}`
        : "";
    const what = unit.kind === "contentType" ? "content type" : "global set";
    const members = unit.fields.map((field) => this.member(field, base));
    this.declarations.push(
      `/** The ${what} ${unit.name} (\`${unit.handle}\`)${usedBy}. */\nexport interface ${name} {\n${members.join("\n")}\n}`,
    );
  }

  private member(field: FieldDefinition, ownerName: string, indent = "  "): string {
    const comment = [field.label, field.helpText].filter((part) => part !== "").join(". ");
    const nullable = field.required ? "" : " | null";
    const type = this.valueType(field, ownerName);
    return `${indent}/** ${escapeComment(comment)} */\n${indent}${field.handle}: ${type}${nullable};`;
  }

  private valueType(field: FieldDefinition, ownerName: string): string {
    switch (field.type) {
      case "text":
      case "textarea":
      case "email":
      case "url":
      case "colour":
        return "string";
      case "date":
        return "string";
      case "number":
        return "number";
      case "toggle":
        return "boolean";
      case "richText":
        return "DeliveredRichText";
      case "markdown":
        return "DeliveredMarkdown";
      case "image":
        return "DeliveredImage";
      case "link":
        return "DeliveredLink";
      case "list":
        return "string[]";
      case "entries":
        return "DeliveredEntryLink[]";
      case "terms":
        return "DeliveredTerm[]";
      case "select": {
        const choices = (field.options.choices ?? []) as { value: string }[];
        const union = choices.map((choice) => JSON.stringify(choice.value)).join(" | ") || "string";
        return field.options.multiple ? `(${union})[]` : union;
      }
      case "blocks":
        return `${this.writeBlocks(field, ownerName)}[]`;
      case "page":
        return "DeliveredPageDesign";
      default:
        return "unknown";
    }
  }

  private writeBlocks(field: FieldDefinition, ownerName: string): string {
    const fieldName = `${ownerName}${pascalCase(field.handle)}`;
    const blockTypes = (field.options.blockTypes ?? []) as StoredBlockType[];
    const blockNames = blockTypes.map((blockType) => {
      const name = this.claim(
        `${fieldName}${pascalCase(blockType.handle)}Block`,
        `${fieldName}${pascalCase(blockType.handle)}BlockType`,
      );
      const members = blockType.fields.map((inner) =>
        this.member(inner, `${fieldName}${pascalCase(blockType.handle)}`, "    "),
      );
      this.declarations.push(
        `/** A ${blockType.name} block in ${field.label}. */\n` +
          `export interface ${name} {\n  id: string;\n  type: ${JSON.stringify(blockType.handle)};\n` +
          `  data: {\n${members.join("\n")}\n  };\n}`,
      );
      return name;
    });
    const unionName = this.claim(`${fieldName}Block`, `${fieldName}Blocks`);
    this.declarations.push(
      `/** Any block in ${field.label}. */\nexport type ${unionName} = ${blockNames.join(" | ") || "never"};`,
    );
    return unionName;
  }

  /** The first name that's free, so two handles that read the same never clash. */
  private claim(preferred: string, fallback: string): string {
    let name = this.names.has(preferred) ? fallback : preferred;
    for (let suffix = 2; this.names.has(name); suffix += 1) {
      name = `${fallback}${suffix}`;
    }
    this.names.add(name);
    return name;
  }

  handleMaps(model: ContentModel): string {
    const units = sortedUnits(model);
    const collections = units.flatMap((unit) =>
      unit.kind === "contentType"
        ? unit.collections.map(
            (collection) =>
              `  ${collection.handle}: ${this.dataNames.get(`contentType:${unit.handle}`)};`,
          )
        : [],
    );
    const globalSets = units.flatMap((unit) =>
      unit.kind === "globalSet"
        ? [`  ${unit.handle}: ${this.dataNames.get(`globalSet:${unit.handle}`)};`]
        : [],
    );
    const handles = (kind: ModelUnit["kind"]) =>
      units
        .filter((unit) => unit.kind === kind)
        .map((unit) => JSON.stringify(unit.handle))
        .join(" | ") || "never";
    return [
      "/** Each collection's entries' data, by collection handle. */",
      `export interface CollectionData {\n${collections.join("\n")}\n}`,
      "",
      "/** Each global set's data, by handle. */",
      `export interface GlobalSetData {\n${globalSets.join("\n")}\n}`,
      "",
      "export type CollectionHandle = keyof CollectionData;",
      "export type GlobalSetHandle = keyof GlobalSetData;",
      `export type TaxonomyHandle = ${handles("taxonomy")};`,
      `export type MenuHandle = ${handles("menu")};`,
    ]
      .join("\n")
      .replaceAll("{\n\n}", "{}");
  }
}

function pascalCase(handle: string): string {
  return labelFromHandle(handle)
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

function escapeComment(text: string): string {
  return text.replaceAll("*/", "*\\/").replaceAll("\n", " ");
}

const HEADER = `/**
 * Types and a client for this site's content, made by \`lintel model types\` from the
 * content model. Don't edit this file: change the content model and run the command again.
 */`;

const RESERVED_NAMES = [
  "DeliveredImage",
  "DeliveredRichText",
  "DeliveredMarkdown",
  "DeliveredLink",
  "DeliveredTerm",
  "DeliveredEntryLink",
  "DeliveredEntry",
  "DeliveredEntryWithTranslations",
  "DeliveredList",
  "DeliveredGlobalSet",
  "DeliveredMenu",
  "DeliveredMenuItem",
  "DeliveredTaxonomy",
  "CollectionData",
  "GlobalSetData",
  "CollectionHandle",
  "GlobalSetHandle",
  "TaxonomyHandle",
  "MenuHandle",
  "LintelClient",
  "LintelClientOptions",
  "LintelRequest",
  "LintelRequestError",
  "LintelUnreachableError",
];

const SHARED_TYPES = `/** An image field's value. \`focalPoint\` is where the subject is, from 0 to 1 across and down. */
export interface DeliveredImage {
  id: string;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  focalPoint: { x: number; y: number } | null;
}

/** A rich text field's value: the editor's document, and the HTML Lintel made from it. */
export interface DeliveredRichText {
  json: unknown;
  html: string;
}

/** A Markdown field's value: the text as written, and its HTML. */
export interface DeliveredMarkdown {
  markdown: string;
  html: string;
}

/**
 * A page field's value: a design from the visual page builder, as versioned JSON. Draw it
 * with \`renderPage\` from \`@lintel/builder/render\`.
 */
export interface DeliveredPageDesign {
  version: number;
  root: Record<string, unknown>;
}

/** A link field's value. */
export interface DeliveredLink {
  url: string;
  label?: string;
}

/** A term chosen in a terms field. */
export interface DeliveredTerm {
  id: string;
  title: string;
  slug: string;
  taxonomy: string;
}

/** A published entry chosen in an entries field. */
export interface DeliveredEntryLink {
  id: string;
  title: string;
  slug: string;
  url: string | null;
  collection: string;
  locale: string;
}

/** One published entry. \`Data\` holds its fields, keyed by handle. */
export interface DeliveredEntry<Data> {
  id: string;
  slug: string;
  /** Where the entry lives on the site, such as "/blog/hello-world". Null if it has no page. */
  url: string | null;
  locale: string;
  /** When it was published, as an ISO date. */
  publishedAt: string | null;
  data: Data;
}

/** A single entry, with where it is published in the site's other languages. */
export interface DeliveredEntryWithTranslations<Data> extends DeliveredEntry<Data> {
  translations: { locale: string; slug: string; url: string | null }[];
}

/** A page of entries from a collection, with the total for pagination. */
export interface DeliveredList<Data> {
  items: DeliveredEntry<Data>[];
  total: number;
}

export interface DeliveredGlobalSet<Data> {
  handle: string;
  name: string;
  locale: string;
  data: Data;
}

export interface DeliveredMenuItem {
  label: string;
  url: string | null;
  newTab: boolean;
  entryId: string | null;
  children: DeliveredMenuItem[];
}

export interface DeliveredMenu {
  handle: string;
  name: string;
  locale: string;
  items: DeliveredMenuItem[];
}

export interface DeliveredTaxonomy {
  handle: string;
  name: string;
  items: { id: string; title: string; slug: string; description: string }[];
}`;

const CLIENT = `/** What a request is for, so a site can cache or tag it (Next.js: \`next: { tags }\`). */
export interface LintelRequest {
  path: string;
  resource: "entries" | "globals" | "menus" | "taxonomies";
  handle: string;
}

export interface LintelClientOptions {
  /** Where Lintel's API is, such as "http://localhost:4000". */
  apiUrl: string;
  /** An API token, for sites set to need one (Settings, then API access). */
  token?: string;
  /** Extra fetch options for a request, such as caching rules. */
  requestInit?: (request: LintelRequest) => RequestInit;
}

/** Lintel answered, but with an error (other than "not found"). */
export class LintelRequestError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string,
  ) {
    super(\`Lintel couldn't send \${path} (\${status}): \${message}\`);
    this.name = "LintelRequestError";
  }
}

/** Lintel didn't answer at all: it isn't running, or the address is wrong. */
export class LintelUnreachableError extends Error {
  constructor(readonly apiUrl: string) {
    super(\`Can't reach Lintel at \${apiUrl}. Check that Lintel is running and that its address is right.\`);
    this.name = "LintelUnreachableError";
  }
}

export interface ListEntriesOptions {
  /** Starts at 1. */
  page?: number;
  /** 25 by default, 100 at most. */
  perPage?: number;
  locale?: string;
  /** With \`term\`: only entries that chose this term. */
  taxonomy?: TaxonomyHandle;
  term?: string;
}

/**
 * Typed reads from the delivery API. Each gives null for a 404 (nothing published there),
 * so pages can show "not found".
 *
 *   const lintel = createLintelClient({ apiUrl: "http://localhost:4000" });
 *   const post = await lintel.getEntry("posts", "hello-world");
 */
export function createLintelClient(options: LintelClientOptions) {
  const apiUrl = options.apiUrl.replace(/\\/+$/, "");

  async function read<Result>(request: LintelRequest): Promise<Result | null> {
    const init = options.requestInit?.(request) ?? {};
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    if (options.token) headers.set("authorization", \`Bearer \${options.token}\`);
    let response: Response;
    try {
      response = await fetch(\`\${apiUrl}\${request.path}\`, { ...init, headers });
    } catch {
      throw new LintelUnreachableError(apiUrl);
    }
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new LintelRequestError(response.status, request.path, await errorMessage(response));
    }
    return (await response.json()) as Result;
  }

  const query = (values: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) search.set(key, String(value));
    }
    const text = search.toString();
    return text === "" ? "" : \`?\${text}\`;
  };

  return {
    /** One published entry by its slug. */
    getEntry<Collection extends CollectionHandle>(
      collection: Collection,
      slug: string,
      { locale }: { locale?: string } = {},
    ) {
      const path = \`/delivery/\${encodeURIComponent(collection)}/\${encodeURIComponent(slug)}\${query({ locale })}\`;
      return read<DeliveredEntryWithTranslations<CollectionData[Collection]>>({
        path,
        resource: "entries",
        handle: collection,
      });
    },
    /** A page of published entries. Null if the collection doesn't exist. */
    listEntries<Collection extends CollectionHandle>(
      collection: Collection,
      { page = 1, perPage = 25, ...filters }: ListEntriesOptions = {},
    ) {
      const path = \`/delivery/\${encodeURIComponent(collection)}\${query({ page, perPage, ...filters })}\`;
      return read<DeliveredList<CollectionData[Collection]>>({
        path,
        resource: "entries",
        handle: collection,
      });
    },
    /** A global set's values. */
    getGlobalSet<Handle extends GlobalSetHandle>(handle: Handle, { locale }: { locale?: string } = {}) {
      const path = \`/delivery/globals/\${encodeURIComponent(handle)}\${query({ locale })}\`;
      return read<DeliveredGlobalSet<GlobalSetData[Handle]>>({ path, resource: "globals", handle });
    },
    /** A menu, with addresses ready to print. */
    getMenu(handle: MenuHandle, { locale }: { locale?: string } = {}) {
      const path = \`/delivery/navigation/\${encodeURIComponent(handle)}\${query({ locale })}\`;
      return read<DeliveredMenu>({ path, resource: "menus", handle });
    },
    /** A taxonomy's terms. */
    getTaxonomy(handle: TaxonomyHandle) {
      const path = \`/delivery/taxonomies/\${encodeURIComponent(handle)}\`;
      return read<DeliveredTaxonomy>({ path, resource: "taxonomies", handle });
    },
  };
}

export type LintelClient = ReturnType<typeof createLintelClient>;

async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "message" in body) {
      return String(body.message);
    }
  } catch {
    // Not JSON; the status says enough.
  }
  return response.statusText;
}`;
