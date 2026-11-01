import type { SiteImportFound, SiteImportItemKind } from "./site-import.schema.js";
import type { SourceEntry, SourceSite } from "./source-site.js";

/**
 * Lists everything an import will bring in, in the order it has to happen: taxonomies and
 * terms before the content types and entries that use them, pictures before the entries
 * that show them, each page after its parent, and menus after the pages they link to.
 */
export interface PlannedSiteItem {
  kind: SiteImportItemKind;
  sourceId: string;
  position: number;
  payload: Record<string, unknown>;
}

export function listSiteItems(site: SourceSite): PlannedSiteItem[] {
  const planned: Array<Omit<PlannedSiteItem, "position">> = [
    ...site.taxonomies.map((taxonomy) => ({
      kind: "taxonomy" as const,
      sourceId: taxonomy.key,
      payload: { key: taxonomy.key, name: taxonomy.name, handle: taxonomy.handle },
    })),
    ...site.taxonomies.flatMap((taxonomy) =>
      taxonomy.terms.map((term) => ({
        kind: "term" as const,
        sourceId: `${taxonomy.key}/${term.key}`,
        payload: { ...term, taxonomyKey: taxonomy.key },
      })),
    ),
    ...site.contentTypes.map((type) => ({
      kind: "contentType" as const,
      sourceId: type.key,
      payload: { ...type, title: type.name },
    })),
    ...site.media.map((media) => ({
      kind: "media" as const,
      sourceId: media.key,
      payload: { ...media, title: media.filename },
    })),
    ...parentsFirst(site.entries).map((entry) => ({
      kind: "entry" as const,
      sourceId: entry.key,
      payload: { ...entry },
    })),
    ...site.menus.map((menu) => ({
      kind: "menu" as const,
      sourceId: menu.key,
      payload: { ...menu, title: menu.name },
    })),
    ...site.globals.map((globalSet) => ({
      kind: "global" as const,
      sourceId: globalSet.key,
      payload: { ...globalSet, title: globalSet.name },
    })),
  ];
  return planned.map((item, position) => ({ ...item, position: position + 1 }));
}

/** Entries in an order where every parent comes before its children; loops are broken. */
export function parentsFirst(entries: readonly SourceEntry[]): SourceEntry[] {
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));
  const ordered: SourceEntry[] = [];
  const placed = new Set<string>();
  const visiting = new Set<string>();
  const place = (entry: SourceEntry) => {
    if (placed.has(entry.key) || visiting.has(entry.key)) return;
    visiting.add(entry.key);
    const parent = entry.parentKey ? byKey.get(entry.parentKey) : undefined;
    if (parent) place(parent);
    visiting.delete(entry.key);
    placed.add(entry.key);
    ordered.push(entry);
  };
  for (const entry of [...entries].sort((first, second) => first.order - second.order)) {
    place(entry);
  }
  return ordered;
}

/** What the files hold, for the preview and the mapping screen. */
export function describeFound(site: SourceSite): SiteImportFound {
  return {
    contentTypes: site.contentTypes.map((type) => ({
      key: type.key,
      name: type.name,
      handle: type.handle,
      structure: type.structure,
      entries: site.entries.filter((entry) => entry.typeKey === type.key).length,
      fields: type.fields.map((field) => ({
        key: field.key,
        label: field.label,
        kind: field.kind,
      })),
    })),
    taxonomies: site.taxonomies.map((taxonomy) => ({
      key: taxonomy.key,
      name: taxonomy.name,
      handle: taxonomy.handle,
      terms: taxonomy.terms.length,
    })),
    media: site.media.length,
    menus: site.menus.length,
    globals: site.globals.length,
    notes: site.notes,
  };
}
