import { randomUUID } from "node:crypto";
import type { ConflictStrategy, LintelExport } from "./transfer-format.js";

/**
 * Working out what an import will do, before it does anything: which things in the export
 * are new here, which this site already has, and what each will be called here. The same
 * plan is shown in Settings → Import's preview and then carried out, so the preview never
 * promises something the import does differently.
 *
 * Things are matched by id first and then by what people see as their identity: a content
 * type, taxonomy, global set or menu by handle, a term by its slug in its taxonomy, a file
 * by its contents and an entry by its address (collection, language and slug).
 */
export const importKinds = [
  "blueprint",
  "collection",
  "taxonomy",
  "term",
  "global",
  "menu",
  "media",
  "entry",
] as const;
export type ImportKind = (typeof importKinds)[number];
export type ImportAction = "create" | "update" | "skip";

export interface ImportPlanItem {
  kind: ImportKind;
  label: string;
  action: ImportAction;
}

export interface ImportPlan {
  strategy: ConflictStrategy;
  totals: Record<ImportKind, Record<ImportAction, number>>;
  items: ImportPlanItem[];
  warnings: string[];
}

/** What this site already has, as far as matching needs to know. */
export interface ExistingContent {
  blueprints: Array<{ id: string; handle: string }>;
  collections: Array<{ id: string; handle: string }>;
  taxonomies: Array<{ id: string; handle: string }>;
  terms: Array<{ id: string; taxonomyId: string; slug: string }>;
  globals: Array<{ id: string; handle: string }>;
  menus: Array<{ id: string; handle: string }>;
  assets: Array<{ id: string; contentHash: string }>;
  entries: Array<{ id: string; collectionId: string; locale: string; slug: string }>;
}

export interface Decision {
  sourceId: string;
  targetId: string;
  action: ImportAction;
}

/** The plan, plus each decision by source id and the id map that rewrites references. */
export interface ResolvedImport {
  plan: ImportPlan;
  decisions: Map<string, Decision>;
  idMap: Map<string, string>;
}

export function planImport(
  document: LintelExport,
  existing: ExistingContent,
  strategy: ConflictStrategy,
  filesAvailable: ReadonlySet<string>,
): ResolvedImport {
  const resolver = new Resolver(strategy);

  resolveByHandle(resolver, "blueprint", document.blueprints, existing.blueprints);
  resolveByHandle(resolver, "collection", document.collections, existing.collections);
  resolveByHandle(resolver, "taxonomy", document.taxonomies, existing.taxonomies);
  for (const taxonomy of document.taxonomies) {
    const taxonomyId = resolver.targetOf(taxonomy.id);
    for (const term of taxonomy.terms) {
      const match = existing.terms.find(
        (candidate) =>
          candidate.id === term.id ||
          (candidate.taxonomyId === taxonomyId && candidate.slug === term.slug),
      );
      resolver.decide(
        "term",
        `${taxonomy.name}: ${term.title}`,
        term.id,
        match?.id,
        existing.terms,
      );
    }
  }
  resolveByHandle(resolver, "global", document.globals, existing.globals);
  resolveByHandle(resolver, "menu", document.menus, existing.menus);
  resolveMedia(resolver, document, existing, filesAvailable);
  resolveEntries(resolver, document, existing);
  return resolver.finish();
}

function resolveByHandle(
  resolver: Resolver,
  kind: ImportKind,
  incoming: ReadonlyArray<{ id: string; handle: string; name: string }>,
  existing: ReadonlyArray<{ id: string; handle: string }>,
) {
  for (const item of incoming) {
    const match = existing.find(
      (candidate) => candidate.id === item.id || candidate.handle === item.handle,
    );
    resolver.decide(kind, item.name, item.id, match?.id, existing);
  }
}

function resolveMedia(
  resolver: Resolver,
  document: LintelExport,
  existing: ExistingContent,
  filesAvailable: ReadonlySet<string>,
) {
  for (const asset of document.media) {
    const match = existing.assets.find(
      (candidate) => candidate.id === asset.id || candidate.contentHash === asset.contentHash,
    );
    if (!match && (!asset.file || !filesAvailable.has(asset.file))) {
      resolver.warn(`${asset.filename} isn't in the export, so it can't be added.`);
      continue;
    }
    resolver.decide("media", asset.filename, asset.id, match?.id, existing.assets);
  }
}

function resolveEntries(resolver: Resolver, document: LintelExport, existing: ExistingContent) {
  const collectionIds = new Map(document.collections.map((row) => [row.handle, row.id]));
  const existingCollections = new Map(existing.collections.map((row) => [row.handle, row.id]));
  for (const entry of document.entries) {
    const sourceCollection = collectionIds.get(entry.collection);
    const collectionId = sourceCollection
      ? resolver.targetOf(sourceCollection)
      : existingCollections.get(entry.collection);
    const title = typeof entry.data.title === "string" ? entry.data.title : entry.slug;
    if (!collectionId) {
      resolver.warn(`“${title}” is in ${entry.collection}, which this site doesn't have.`);
      continue;
    }
    const match = existing.entries.find(
      (candidate) =>
        candidate.id === entry.id ||
        (candidate.collectionId === collectionId &&
          candidate.locale === entry.locale &&
          candidate.slug === entry.slug),
    );
    resolver.decide("entry", title, entry.id, match?.id, existing.entries);
  }
}

class Resolver {
  private readonly items: ImportPlanItem[] = [];
  private readonly warnings: string[] = [];
  private readonly decisions = new Map<string, Decision>();
  private readonly idMap = new Map<string, string>();

  constructor(private readonly strategy: ConflictStrategy) {}

  decide(
    kind: ImportKind,
    label: string,
    sourceId: string,
    matchedId: string | undefined,
    existing: ReadonlyArray<{ id: string }>,
  ) {
    let decision: Decision;
    if (matchedId) {
      const action = this.strategy === "overwrite" ? "update" : "skip";
      decision = { sourceId, targetId: matchedId, action };
    } else {
      // Keep the export's id unless something else here already has it.
      const idTaken = existing.some((candidate) => candidate.id === sourceId);
      decision = { sourceId, targetId: idTaken ? randomUUID() : sourceId, action: "create" };
    }
    this.decisions.set(sourceId, decision);
    if (decision.targetId !== sourceId) {
      this.idMap.set(sourceId, decision.targetId);
    }
    this.items.push({ kind, label, action: decision.action });
  }

  targetOf(sourceId: string): string | undefined {
    return this.decisions.get(sourceId)?.targetId;
  }

  warn(message: string) {
    this.warnings.push(message);
  }

  finish(): ResolvedImport {
    const totals = Object.fromEntries(
      importKinds.map((kind) => [kind, { create: 0, update: 0, skip: 0 }]),
    ) as ImportPlan["totals"];
    for (const item of this.items) {
      totals[item.kind][item.action] += 1;
    }
    return {
      plan: { strategy: this.strategy, totals, items: this.items, warnings: this.warnings },
      decisions: this.decisions,
      idMap: this.idMap,
    };
  }
}

/**
 * Rewrites ids inside field values (an image field's asset id, a terms field's term ids,
 * a menu item's entry id) to what they are called here. Ids are UUIDs, so a string that
 * equals one can only be that reference.
 */
export function remapIds<Value>(value: Value, idMap: ReadonlyMap<string, string>): Value {
  if (idMap.size === 0) {
    return value;
  }
  return remapValue(value, idMap) as Value;
}

function remapValue(value: unknown, idMap: ReadonlyMap<string, string>): unknown {
  if (typeof value === "string") {
    return idMap.get(value) ?? value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => remapValue(item, idMap));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, remapValue(item, idMap)]),
    );
  }
  return value;
}
