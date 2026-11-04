import {
  findNode,
  type PageClash,
  type PageDocument,
  type PageNode,
  standardCatalogue,
} from "@lintel/builder-model";
import type { EntryDraft } from "../content/entryDraft.js";
import { draftFromEntry } from "../content/entryDraft.js";
import type { EntryConflict } from "../content/useEntryActions.js";
import { t } from "../i18n/strings.js";
import type { ClashItem } from "./ConflictDialog.js";

const LONGEST_WORDS = 80;

function wordsOf(value: unknown): string | undefined {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return undefined;
  return value.length > LONGEST_WORDS ? `${value.slice(0, LONGEST_WORDS)}…` : value;
}

/** What both people changed in an entry's fields, by their labels. */
export function describeEntryClashes(
  conflict: EntryConflict,
  fields: readonly { handle: string; label: string }[],
  current: EntryDraft,
): ClashItem[] {
  const theirs = draftFromEntry(conflict.latest);
  return conflict.handles.map((handle) => {
    if (handle === "slug") {
      return { label: t("collab.field.slug"), mine: current.slug, theirs: theirs.slug };
    }
    if (handle === "parentId") return { label: t("collab.field.parent") };
    const label = fields.find((field) => field.handle === handle)?.label ?? handle;
    const mine = wordsOf(current.data[handle]);
    const others = wordsOf(theirs.data[handle]);
    return {
      label,
      ...(mine === undefined ? {} : { mine }),
      ...(others === undefined ? {} : { theirs: others }),
    };
  });
}

/** An element as someone would know it: its name, its words, or what kind of thing it is. */
function nameOfElement(node: PageNode): string {
  const words = node.props.text ?? node.props.label;
  if (node.name) return node.name;
  if (typeof words === "string" && words.trim() !== "") return `“${wordsOf(words)}”`;
  return standardCatalogue.find(node.type)?.label ?? node.type;
}

/** What both people changed on a page's design, by what each element is called. */
export function describeDesignClashes(
  clashes: readonly PageClash[],
  base: PageDocument,
  theirs: PageDocument,
): ClashItem[] {
  const labels = new Set<string>();
  for (const { nodeId } of clashes) {
    const node = findNode(theirs.root, nodeId) ?? findNode(base.root, nodeId);
    if (node) labels.add(nameOfElement(node));
  }
  return [...labels].map((label) => ({ label }));
}
