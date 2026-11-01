import type { WordPressItemKind } from "./wordpress-import.schema.js";
import type { WordPressItem, WordPressSite } from "./wxr-parser.js";

/**
 * Lists everything an import will bring in, in the order it has to happen: people and
 * terms before the posts that point at them, files before the posts that show them, and
 * each page after its parent, so a parent's new id is always known in time.
 */
export interface PlannedItem {
  kind: WordPressItemKind;
  sourceId: string;
  position: number;
  payload: Record<string, unknown>;
}

export function listWordPressItems(site: WordPressSite): PlannedItem[] {
  const planned: Array<Omit<PlannedItem, "position">> = [
    ...site.authors.map((author) => ({
      kind: "author" as const,
      sourceId: author.login,
      payload: { ...author },
    })),
    ...site.categories.map((term) => ({
      kind: "category" as const,
      sourceId: term.slug,
      payload: { slug: term.slug, name: term.name },
    })),
    ...site.tags.map((term) => ({
      kind: "tag" as const,
      sourceId: term.slug,
      payload: { slug: term.slug, name: term.name },
    })),
    ...site.items
      .filter((item) => item.type === "attachment" && item.attachmentUrl)
      .map((item) => ({
        kind: "attachment" as const,
        sourceId: item.id,
        payload: { url: item.attachmentUrl, title: item.title, alt: item.altText },
      })),
    ...parentsFirst(site.items.filter((item) => item.type === "page")).map(entryItem),
    ...site.items.filter((item) => item.type === "post").map(entryItem),
  ];
  return planned.map((item, position) => ({ ...item, position: position + 1 }));
}

function entryItem(item: WordPressItem) {
  return { kind: item.type as WordPressItemKind, sourceId: item.id, payload: { ...item } };
}

/** Pages in an order where every parent comes before its children; loops are broken. */
export function parentsFirst(pages: readonly WordPressItem[]): WordPressItem[] {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const ordered: WordPressItem[] = [];
  const placed = new Set<string>();
  const visiting = new Set<string>();

  const place = (page: WordPressItem) => {
    if (placed.has(page.id) || visiting.has(page.id)) {
      return;
    }
    visiting.add(page.id);
    const parent = byId.get(page.parentId);
    if (parent) {
      place(parent);
    }
    visiting.delete(page.id);
    placed.add(page.id);
    ordered.push(page);
  };

  for (const page of [...pages].sort((first, second) => first.menuOrder - second.menuOrder)) {
    place(page);
  }
  return ordered;
}
