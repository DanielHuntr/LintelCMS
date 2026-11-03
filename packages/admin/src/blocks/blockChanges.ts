import type { PageNode } from "@lintel/builder-model";
import type { DraftField } from "../content-types/blueprintDraft.js";

/**
 * Saving a block's properties: which handles were renamed (so pages keep what was filled
 * in), and the design without bindings to properties that are gone (so it still saves).
 */

/** Saved properties whose handle was edited, old to new. Fields from the API have `saved:` keys. */
export function renamedProperties(fields: readonly DraftField[]): Record<string, string> {
  const renames: Record<string, string> = {};
  for (const field of fields) {
    if (!field.key.startsWith("saved:")) continue;
    const original = field.key.slice("saved:".length);
    if (original !== field.handle) renames[original] = field.handle;
  }
  return renames;
}

/** The design with bindings to these properties taken out, at every level. */
export function withoutBindingsTo(design: PageNode, removed: readonly string[]): PageNode {
  if (removed.length === 0) return design;
  const strip = (node: PageNode): PageNode => {
    const next: PageNode = { ...node, children: node.children.map(strip) };
    if (node.bindings) {
      const kept = Object.fromEntries(
        Object.entries(node.bindings).filter(([, handle]) => !removed.includes(handle)),
      );
      if (Object.keys(kept).length > 0) next.bindings = kept;
      else delete next.bindings;
    }
    return next;
  };
  return strip(design);
}
