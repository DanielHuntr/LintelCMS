import {
  type AnyComponentDefinition,
  type ComponentCatalogue,
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

/** What the Insert panel offers: `component:heading`, `template:hero` or one of the site's own blocks, `block:team_card`. */
export type InsertKey = `component:${string}` | `template:${string}` | `block:${string}`;

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
  /** More words the search looks through, such as "bakery" for Opening times. */
  keywords: readonly string[];
  /** Sections are drawn as a sketch; elements as their icon. */
  blueprint?: NodeBlueprint;
  icon?: string;
}

export const sectionGroupTitles: Record<SectionCategory, BuilderStringKey> = {
  intro: "pageBuilder.insert.sectionCategory.intro",
  features: "pageBuilder.insert.sectionCategory.features",
  about: "pageBuilder.insert.sectionCategory.about",
  pictures: "pageBuilder.insert.sectionCategory.pictures",
  proof: "pageBuilder.insert.sectionCategory.proof",
  pricing: "pageBuilder.insert.sectionCategory.pricing",
  questions: "pageBuilder.insert.sectionCategory.questions",
  contact: "pageBuilder.insert.sectionCategory.contact",
  shop: "pageBuilder.insert.sectionCategory.shop",
  footer: "pageBuilder.insert.sectionCategory.footer",
};

export const elementGroupTitles: Record<ComponentCategory, BuilderStringKey> = {
  blocks: "pageBuilder.insert.category.blocks",
  layout: "pageBuilder.insert.category.layout",
  text: "pageBuilder.insert.category.text",
  media: "pageBuilder.insert.category.media",
  navigation: "pageBuilder.insert.category.navigation",
  collections: "pageBuilder.insert.category.collections",
  forms: "pageBuilder.insert.category.forms",
  shop: "pageBuilder.insert.category.shop",
  code: "pageBuilder.insert.category.code",
};

/**
 * Whether every element in a section can be used: a section with a product grid needs the
 * shop, one with a form needs Forms. Without `enabledPlugins`, everything is available.
 */
export function isTemplateAvailable(
  blueprint: NodeBlueprint,
  catalogue: ComponentCatalogue,
  enabledPlugins: readonly string[] | undefined,
): boolean {
  const plugin = catalogue.find(blueprint.type)?.requiresPlugin;
  if (plugin && enabledPlugins && !enabledPlugins.includes(plugin)) return false;
  return (blueprint.children ?? []).every((child) =>
    isTemplateAvailable(child, catalogue, enabledPlugins),
  );
}

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
        keywords: template.keywords ?? [],
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
        keywords: [],
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
 * Items whose name, description, keywords or group has every word typed: names that start with the
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
      `${item.label} ${item.description} ${item.keywords.join(" ")} ${groupTitle(item.groupTitle)}`.toLowerCase();
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
    .filter(
      (key): key is InsertKey =>
        key.startsWith("component:") || key.startsWith("template:") || key.startsWith("block:"),
    );
}
