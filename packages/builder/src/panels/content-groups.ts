import type { EditableField, EditableFieldKind, PageNode } from "@lintel/builder-model";
import type { BuilderStringKey } from "../i18n/builder-strings.js";
import type { Translate } from "../i18n/builder-text.js";

/**
 * Elements with many things to fill in (a hero block has a picture, words, a button and
 * options) show them in collapsible groups, so the Content tab starts short. Elements with a
 * few fields show them all at once.
 */

export type ContentGroupId = "words" | "link" | "picture" | "options";

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
};

const groupTitles: Record<ContentGroupId, BuilderStringKey> = {
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
    const id = field.prop === "alt" ? "picture" : groupOfKind[field.kind];
    const group = groups.get(id) ?? { id, title: groupTitles[id], fields: [] };
    group.fields.push(field);
    groups.set(id, group);
  }
  return [...groups.values()];
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
