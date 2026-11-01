import {
  type AnyComponentDefinition,
  componentCategories,
  type ComponentCategory,
  type NodeBlueprint,
  sectionCategories,
  type SectionCategory,
  type SectionTemplate,
} from "@lintel/builder-model";
import type { BuilderStringKey } from "../i18n/builder-strings.js";

/**
 * Everything the Insert panel offers, as one list: ready-made sections and single elements,
 * each with its group, so the panel can show them by group, search them and remember the
 * ones used recently.
 */

/** What the Insert panel offers: `component:heading` or `template:hero`. */
export type InsertKey = `component:${string}` | `template:${string}`;

export type InsertKind = "sections" | "elements";

export interface InsertItem {
  key: InsertKey;
  kind: InsertKind;
  label: string;
  description: string;
  group: SectionCategory | ComponentCategory;
  groupTitle: BuilderStringKey;
  /** The element type it adds, for dropping into Layers. */
  type: string;
  /** Sections are drawn as a sketch; elements as their icon. */
  blueprint?: NodeBlueprint;
  icon?: string;
}

export const sectionGroupTitles: Record<SectionCategory, BuilderStringKey> = {
  hero: "pageBuilder.insert.sectionCategory.hero",
  features: "pageBuilder.insert.sectionCategory.features",
  story: "pageBuilder.insert.sectionCategory.story",
  testimonials: "pageBuilder.insert.sectionCategory.testimonials",
  pricing: "pageBuilder.insert.sectionCategory.pricing",
  questions: "pageBuilder.insert.sectionCategory.questions",
  callToAction: "pageBuilder.insert.sectionCategory.callToAction",
  contact: "pageBuilder.insert.sectionCategory.contact",
  footer: "pageBuilder.insert.sectionCategory.footer",
};

export const elementGroupTitles: Record<ComponentCategory, BuilderStringKey> = {
  blocks: "pageBuilder.insert.category.blocks",
  layout: "pageBuilder.insert.category.layout",
  text: "pageBuilder.insert.category.text",
  media: "pageBuilder.insert.category.media",
  navigation: "pageBuilder.insert.category.navigation",
  code: "pageBuilder.insert.category.code",
};

export function insertItems(
  templates: readonly SectionTemplate[],
  definitions: readonly AnyComponentDefinition[],
): InsertItem[] {
  const sections = sectionCategories.flatMap((category) =>
    templates
      .filter((template) => template.category === category)
      .map((template): InsertItem => ({
        key: `template:${template.id}`,
        kind: "sections",
        label: template.label,
        description: template.description,
        group: category,
        groupTitle: sectionGroupTitles[category],
        type: template.blueprint.type,
        blueprint: template.blueprint,
      })),
  );
  const elements = componentCategories.flatMap((category) =>
    definitions
      .filter((definition) => definition.category === category)
      .map((definition): InsertItem => ({
        key: `component:${definition.type}`,
        kind: "elements",
        label: definition.label,
        description: definition.description,
        group: category,
        groupTitle: elementGroupTitles[category],
        type: definition.type,
        icon: definition.icon,
      })),
  );
  return [...sections, ...elements];
}

export interface InsertGroup {
  id: InsertItem["group"];
  title: BuilderStringKey;
  items: InsertItem[];
}

/** One kind's items by group, in the library's order, leaving out empty groups. */
export function groupInsertItems(items: readonly InsertItem[], kind: InsertKind): InsertGroup[] {
  const groups = new Map<InsertItem["group"], InsertGroup>();
  for (const item of items) {
    if (item.kind !== kind) continue;
    const group = groups.get(item.group) ?? { id: item.group, title: item.groupTitle, items: [] };
    group.items.push(item);
    groups.set(item.group, group);
  }
  return [...groups.values()];
}

/**
 * Items whose name, description or group has every word typed: names that start with the
 * search first, then names that have it, then the rest. `groupTitle`
 * turns a group's string key into its words, so "pictures" finds everything in Pictures.
 */
export function searchInsertItems(
  items: readonly InsertItem[],
  search: string,
  groupTitle: (key: BuilderStringKey) => string,
): InsertItem[] {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const matches = items.filter((item) => {
    const haystack =
      `${item.label} ${item.description} ${groupTitle(item.groupTitle)}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
  const phrase = words.join(" ");
  const rank = (item: InsertItem) => {
    const name = item.label.toLowerCase();
    if (name.startsWith(phrase)) return 0;
    return words.every((word) => name.includes(word)) ? 1 : 2;
  };
  return matches.sort((first, second) => rank(first) - rank(second));
}

/** How many recently used items are remembered. */
export const recentLimit = 8;

/** The recent list after using `key`: it moves to the front, the oldest drop off the end. */
export function withRecentlyUsed(recent: readonly InsertKey[], key: InsertKey): InsertKey[] {
  return [key, ...recent.filter((candidate) => candidate !== key)].slice(0, recentLimit);
}

export function readRecentlyUsed(stored: string | null): InsertKey[] {
  return (stored ?? "")
    .split(",")
    .filter((key): key is InsertKey => key.startsWith("component:") || key.startsWith("template:"));
}
