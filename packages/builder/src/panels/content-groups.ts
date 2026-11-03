import type { EditableField, EditableFieldKind, PageNode } from "@lintel/builder-model";
import type { BuilderStringKey } from "../i18n/builder-strings.js";
import type { Translate } from "../i18n/builder-text.js";

/**
 * Elements with many things to fill in (a hero block has a picture, words, a button and
 * options) show them in collapsible groups, so the Content tab starts short. Elements with a
 * few fields show them all at once.
 */

export type ContentGroupId = "source" | "words" | "link" | "picture" | "options" | "more";

export interface ContentGroup {
  id: ContentGroupId;
  title: BuilderStringKey;
  fields: EditableField[];
}

/** More fields than this, in more than one group, and the groups become collapsible. */
export const fieldsShownTogether = 3;

const groupOfKind: Record<EditableFieldKind, ContentGroupId> = {
  text: "words",
  multilineText: "words",
  textList: "words",
  link: "link",
  linkList: "link",
  image: "picture",
  choice: "options",
  toggle: "options",
  number: "options",
  dateTime: "options",
  icon: "picture",
  itemList: "words",
  source: "source",
  file: "source",
};

const groupTitles: Record<ContentGroupId, BuilderStringKey> = {
  source: "pageBuilder.content.group.source",
  more: "pageBuilder.content.group.more",
  words: "pageBuilder.content.group.words",
  link: "pageBuilder.content.group.link",
  picture: "pageBuilder.content.group.picture",
  options: "pageBuilder.content.group.options",
};

/** The fields in groups, in the order their first field appears. */
export function groupContentFields(fields: readonly EditableField[]): ContentGroup[] {
  const groups = new Map<ContentGroupId, ContentGroup>();
  for (const field of fields) {
    // A picture's description belongs with the picture, not with the words on the page.
    // Advanced options are folded away together, after everything else.
    const id = field.advanced
      ? "more"
      : field.prop === "alt" || field.prop === "showCredit"
        ? "picture"
        : groupOfKind[field.kind];
    const group = groups.get(id) ?? { id, title: groupTitles[id], fields: [] };
    group.fields.push(field);
    groups.set(id, group);
  }
  // Groups keep the order their first field appears in, except that "What it shows" comes
  // first and "More options" last (the sort is stable).
  const rank = (group: ContentGroup) => (group.id === "source" ? -1 : group.id === "more" ? 1 : 0);
  return [...groups.values()].sort((first, second) => rank(first) - rank(second));
}

function shortened(words: string, length = 40): string {
  const oneLine = words.replace(/\s+/g, " ").trim();
  return oneLine.length > length ? `${oneLine.slice(0, length - 1).trimEnd()}…` : oneLine;
}

function fieldSummary(field: EditableField, node: PageNode, text: Translate): string | undefined {
  const value = node.props[field.prop];
  switch (field.kind) {
    case "text":
    case "multilineText":
    case "link":
      return typeof value === "string" && value.trim() !== "" ? shortened(value) : undefined;
    case "textList":
    case "linkList":
    case "itemList":
      return Array.isArray(value) && value.length > 0
        ? text("pageBuilder.content.summary.items", { count: value.length })
        : undefined;
    case "image": {
      if (typeof value !== "string" || value === "") return undefined;
      const alt = typeof node.props.alt === "string" ? node.props.alt : "";
      return alt ? shortened(alt) : text("pageBuilder.content.summary.pictureChosen");
    }
    case "choice":
      return field.choices.find((choice) => choice.value === String(value ?? ""))?.label;
    case "toggle":
      return value === true
        ? text("pageBuilder.content.summary.on", { name: field.label })
        : undefined;
    case "number":
      return typeof value === "number" ? `${field.label}: ${value}` : undefined;
    case "dateTime":
    case "icon":
    case "source":
      return typeof value === "string" && value !== "" ? shortened(value) : undefined;
    case "file":
      return typeof value === "string" && value !== ""
        ? shortened(value.split("/").pop() ?? value)
        : undefined;
  }
}

/** What a closed group shows: its first filled-in value, such as the heading's words. */
export function contentGroupSummary(group: ContentGroup, node: PageNode, text: Translate): string {
  if (group.id === "options") {
    return group.fields
      .map((field) => fieldSummary(field, node, text))
      .filter(Boolean)
      .join(" · ");
  }
  for (const field of group.fields) {
    const summary = fieldSummary(field, node, text);
    if (summary) return summary;
  }
  return "";
}
