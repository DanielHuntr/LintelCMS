import { posix } from "node:path";
import { parse as parseYaml } from "yaml";
import type { ZipArchiveReader } from "../../archives/zip-reader.js";
import { slugify } from "../../entries/slugs.js";
import { fieldHandle } from "../imported-fields.js";
import { listArchiveFiles, readArchiveText } from "../import-archives.js";
import { NotAnExportError } from "../site-import.errors.js";
import {
  emptySourceSite,
  type SourceEntry,
  type SourceMedia,
  type SourceMenuLink,
  type SourceSite,
} from "../source-site.js";
import type { SourceFiles } from "./source-reader.js";
import {
  blueprintFieldConfigs,
  fieldsFromValues,
  isRecord,
  readStatamicFields,
  readStatamicValue,
} from "./statamic-fields.js";

/**
 * Statamic keeps a site's content as files, so the import reads a zip of the site's
 * folder (or just its `content` and `resources/blueprints` folders, with the assets):
 *
 *   content/collections/<handle>.yaml          a collection: title, route, dated or a tree
 *   content/collections/<handle>/*.md          its entries: front matter, then Markdown
 *   content/trees/collections/<handle>.yaml    the page tree's order and nesting
 *   resources/blueprints/collections/<handle>/ its blueprints: the fields and their types
 *   content/taxonomies/<handle>/*.yaml         terms
 *   content/globals/<handle>.yaml              global values
 *   content/navigation, content/trees/navigation   menus
 *   public/assets/...                          the files assets fields point at
 */
type Files = Map<string, string>;
type Data = Record<string, unknown>;

export async function readStatamicExport(input: SourceFiles): Promise<SourceSite> {
  if (!input.archive) {
    throw new NotAnExportError("statamic", "upload the site's folder as a .zip");
  }
  const files = listArchiveFiles(input.archive);
  const base = [...files.keys()]
    .map((path) => /^(.*?)content\/collections\//.exec(path)?.[1])
    .find((prefix) => prefix !== undefined);
  if (base === undefined) {
    throw new NotAnExportError("statamic", "there's no content/collections folder in the zip");
  }
  const reader = new StatamicFolder(input.archive, files, base);
  return reader.read();
}

class StatamicFolder {
  private readonly site = emptySourceSite("Statamic site");
  private readonly media = new Map<string, SourceMedia>();
  private readonly leftOut = new Set<string>();

  constructor(
    private readonly archive: ZipArchiveReader,
    private readonly files: Files,
    private readonly base: string,
  ) {}

  async read(): Promise<SourceSite> {
    await this.readTaxonomies();
    for (const handle of this.namesIn("content/collections/", ".yaml")) {
      await this.readCollection(handle);
    }
    await this.readGlobals();
    await this.readNavigation();
    this.site.media = [...this.media.values()];
    if (this.leftOut.size > 0) {
      this.site.notes.push(
        `These fields have no equal in Lintel, so they weren't brought in: ${[...this.leftOut].join(", ")}.`,
      );
    }
    this.site.notes.push(
      "Templates (Antlers or Blade views), forms, users and Bard's sets aren't content, so they don't come across.",
    );
    return this.site;
  }

  private namesIn(folder: string, extension: string): string[] {
    const prefix = `${this.base}${folder}`;
    return [...this.files.keys()]
      .filter((path) => path.startsWith(prefix) && path.endsWith(extension))
      .map((path) => path.slice(prefix.length, -extension.length))
      .filter((name) => !name.includes("/"));
  }

  private pathsUnder(folder: string): string[] {
    const prefix = `${this.base}${folder}`;
    return [...this.files.keys()].filter((path) => path.startsWith(prefix)).sort();
  }

  private async yaml(path: string): Promise<Data | null> {
    const real = this.files.get(`${this.base}${path}`);
    if (!real) return null;
    const text = await readArchiveText(this.archive, real);
    return text === null ? null : parseYamlSafely(text);
  }

  private async readTaxonomies() {
    for (const handle of this.namesIn("content/taxonomies/", ".yaml")) {
      const settings = (await this.yaml(`content/taxonomies/${handle}.yaml`)) ?? {};
      const terms = [];
      for (const path of this.pathsUnder(`content/taxonomies/${handle}/`)) {
        if (!path.endsWith(".yaml")) continue;
        const data = parseYamlSafely((await readArchiveText(this.archive, this.real(path))) ?? "");
        const slug = posix.basename(path, ".yaml");
        terms.push({
          key: slug,
          title: String(data.title ?? slug),
          slug,
          description: typeof data.content === "string" ? data.content : "",
        });
      }
      this.site.taxonomies.push({
        key: handle,
        name: String(settings.title ?? handle),
        handle: fieldHandle(handle),
        terms,
      });
    }
  }

  private real(path: string): string {
    return this.files.get(path) ?? path;
  }

  private async readCollection(handle: string) {
    const settings = (await this.yaml(`content/collections/${handle}.yaml`)) ?? {};
    const structure = isRecord(settings.structure) ? settings.structure : null;
    const route = String(settings.route ?? `/${handle}/{slug}`);
    const entries: Array<{ data: Data; body: string; path: string }> = [];
    for (const path of this.pathsUnder(`content/collections/${handle}/`)) {
      if (!/\.(md|yaml)$/.test(path)) continue;
      const text = await readArchiveText(this.archive, this.real(path));
      if (text !== null) entries.push({ ...splitFrontMatter(text), path });
    }
    const configs = (await this.blueprintsOf(handle)).flatMap(blueprintFieldConfigs);
    const taxonomyKeys = new Set(this.site.taxonomies.map((taxonomy) => taxonomy.key));
    const read = configs.length
      ? readStatamicFields(configs, taxonomyKeys)
      : { fields: fieldsFromValues(entries.map((entry) => entry.data)), leftOut: [] };
    read.leftOut.forEach((field) => this.leftOut.add(field));
    if (!read.fields.some((field) => field.key === "content") && entries.some((e) => e.body)) {
      read.fields.push({ key: "content", label: "Content", kind: "markdown" });
    }
    const unique = [...new Map(read.fields.map((field) => [field.key, field])).values()];
    this.site.contentTypes.push({
      key: handle,
      name: String(settings.title ?? handle),
      handle: fieldHandle(handle),
      structure: structure ? "tree" : settings.dated === true ? "dated" : "flat",
      routePrefix: routePrefix(route),
      fields: unique,
    });

    const tree = await this.treeOf(handle, structure);
    const sourceEntries: SourceEntry[] = entries.map(({ data, body, path }, index) => {
      const fileName = posix.basename(path).replace(/\.(md|yaml)$/, "");
      const dated = /^(\d{4}-\d{2}-\d{2})(?:-(\d{4}))?\.(.+)$/.exec(fileName);
      const slug = String(data.slug ?? (dated ? dated[3] : fileName));
      const id = String(data.id ?? `${handle}/${slug}`);
      const values: SourceEntry["values"] = {};
      for (const field of unique) {
        const raw = field.key === "content" && data.content === undefined ? body : data[field.key];
        values[field.key] = readStatamicValue(raw, field, {
          term: (taxonomy, termSlug) => `${taxonomy}/${termSlug}`,
          asset: (assetPath) => this.asset(assetPath),
        });
      }
      const placed = tree.get(id);
      const date = dated?.[1] ?? (typeof data.date === "string" ? data.date : null);
      return {
        key: id,
        typeKey: handle,
        title: String(data.title ?? slug),
        slug,
        parentKey: placed?.parent ?? null,
        order: placed?.order ?? index,
        published: data.published !== false,
        date: date ? new Date(date).toISOString() : null,
        oldPath: "",
        values,
      };
    });
    for (const entry of sourceEntries) {
      entry.oldPath = oldAddress(route, entry, sourceEntries, structure?.root === true);
    }
    this.site.entries.push(...sourceEntries);
  }

  private async blueprintsOf(handle: string): Promise<unknown[]> {
    const blueprints = [];
    for (const path of this.pathsUnder(`resources/blueprints/collections/${handle}/`)) {
      if (!path.endsWith(".yaml")) continue;
      blueprints.push(
        parseYamlSafely((await readArchiveText(this.archive, this.real(path))) ?? ""),
      );
    }
    return blueprints;
  }

  /** Each entry's parent and place, from the tree file (or, before Statamic 3.1, the collection). */
  private async treeOf(handle: string, structure: Data | null) {
    const placed = new Map<string, { parent: string | null; order: number }>();
    if (!structure) return placed;
    const file = await this.yaml(`content/trees/collections/${handle}.yaml`);
    const tree = file?.tree ?? structure.tree;
    const walk = (branches: unknown, parent: string | null) => {
      if (!Array.isArray(branches)) return;
      branches.forEach((branch, order) => {
        if (!isRecord(branch) || typeof branch.entry !== "string") return;
        placed.set(branch.entry, { parent, order });
        walk(branch.children, branch.entry);
      });
    };
    walk(tree, null);
    return placed;
  }

  /** An assets field's value ("photos/loaf.jpg") is a file under an assets folder. */
  private asset(path: string): string | null {
    const clean = path.replace(/^[a-z0-9_]+::/i, "");
    const real = [...this.files.entries()].find(
      ([logical]) =>
        logical === clean ||
        logical.endsWith(`/assets/${clean}`) ||
        logical === `${this.base}assets/${clean}`,
    )?.[1];
    if (!real) {
      this.leftOut.add(`the file ${clean}, which isn't in the zip`);
      return null;
    }
    const key = `asset:${clean}`;
    if (!this.media.has(key)) {
      this.media.set(key, { key, filename: posix.basename(clean), alt: "", archivePath: real });
    }
    return key;
  }

  private async readGlobals() {
    for (const handle of this.namesIn("content/globals/", ".yaml")) {
      const file = (await this.yaml(`content/globals/${handle}.yaml`)) ?? {};
      // Statamic 3 keeps values in the file; later versions in a folder per site.
      const siteValues = this.pathsUnder("content/globals/").find((path) =>
        path.endsWith(`/${handle}.yaml`),
      );
      const data = isRecord(file.data)
        ? file.data
        : siteValues
          ? parseYamlSafely((await readArchiveText(this.archive, this.real(siteValues))) ?? "")
          : {};
      const blueprint = await this.yaml(`resources/blueprints/globals/${handle}.yaml`);
      const read = blueprint
        ? readStatamicFields(blueprintFieldConfigs(blueprint), new Set())
        : { fields: fieldsFromValues([data]), leftOut: [] };
      const values: Record<string, ReturnType<typeof readStatamicValue>> = {};
      for (const field of read.fields) {
        values[field.key] = readStatamicValue(data[field.key], field, {
          term: (taxonomy, slug) => `${taxonomy}/${slug}`,
          asset: (path) => this.asset(path),
        });
      }
      this.site.globals.push({
        key: handle,
        name: String(file.title ?? handle),
        handle: fieldHandle(handle),
        fields: read.fields.map((field) => ({ ...field, key: fieldHandle(field.key) })),
        values: Object.fromEntries(
          Object.entries(values).map(([key, value]) => [fieldHandle(key), value]),
        ),
      });
    }
  }

  private async readNavigation() {
    for (const handle of this.namesIn("content/navigation/", ".yaml")) {
      const settings = (await this.yaml(`content/navigation/${handle}.yaml`)) ?? {};
      const file = await this.yaml(`content/trees/navigation/${handle}.yaml`);
      const toLinks = (branches: unknown): SourceMenuLink[] =>
        Array.isArray(branches)
          ? branches.filter(isRecord).map((branch) => ({
              label: String(branch.title ?? ""),
              entryKey: typeof branch.entry === "string" ? branch.entry : null,
              url: typeof branch.url === "string" ? branch.url : null,
              children: toLinks(branch.children),
            }))
          : [];
      this.site.menus.push({
        key: handle,
        name: String(settings.title ?? handle),
        links: toLinks(file?.tree ?? settings.tree),
      });
    }
  }
}

/** "---\ntitle: Hi\n---\nBody" → the front matter's values and the body. */
export function splitFrontMatter(text: string): { data: Data; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) return { data: parseYamlSafely(text), body: "" };
  return { data: parseYamlSafely(match[1] ?? ""), body: (match[2] ?? "").trim() };
}

/** YAML from an upload: no custom tags, and a size cap on aliases so it can't balloon. */
function parseYamlSafely(text: string): Data {
  try {
    const value: unknown = parseYaml(text, { maxAliasCount: 50, customTags: [] });
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

/** "/blog/{slug}" → "/blog"; "{parent_uri}/{slug}" → "". */
export function routePrefix(route: string): string {
  const before = route.split("{")[0] ?? "";
  return before === "/" ? "" : before.replace(/\/+$/, "");
}

function oldAddress(
  route: string,
  entry: SourceEntry,
  entries: readonly SourceEntry[],
  hasRoot: boolean,
): string {
  if (hasRoot && entry.parentKey === null && entry.order === 0) return "/";
  const byKey = new Map(entries.map((candidate) => [candidate.key, candidate]));
  const parents: string[] = [];
  for (let parent = entry.parentKey ? byKey.get(entry.parentKey) : undefined; parent;) {
    if (!(hasRoot && parent.parentKey === null && parent.order === 0)) parents.unshift(parent.slug);
    parent = parent.parentKey ? byKey.get(parent.parentKey) : undefined;
  }
  const date = entry.date ? new Date(entry.date) : null;
  const filled = route
    .replace("{parent_uri}", parents.length ? `/${parents.join("/")}` : "")
    .replace("{slug}", entry.slug)
    .replace("{year}", date ? String(date.getUTCFullYear()) : "")
    .replace("{month}", date ? String(date.getUTCMonth() + 1).padStart(2, "0") : "")
    .replace("{day}", date ? String(date.getUTCDate()).padStart(2, "0") : "")
    .replace(/\{[^}]*\}/g, "");
  return `/${filled}`.replace(/\/{2,}/g, "/").replace(/(.)\/$/, "$1") || slugify(entry.slug);
}
