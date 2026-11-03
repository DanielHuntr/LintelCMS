import { splitList, type OptionDraft, type VariantDraft } from "./productDraft.js";

/**
 * The working-out behind the variants table: which options it can group by, what each group
 * holds, and stock. Stock is typed per location, so the table always edits one location.
 */

export interface VariantRow {
  variant: VariantDraft;
  /** Where it is in the draft; error messages from saving are numbered by this. */
  index: number;
}

export interface VariantGroup {
  key: string;
  name: string;
  rows: VariantRow[];
}

export interface GroupingChoice {
  name: string;
  /** Where this option's value sits in each variant's `optionValues`. */
  position: number;
}

/** What people chose about how the table looks. It outlasts saving, which redraws the form. */
export interface VariantTableView {
  groupBy: number | "first" | "none";
  openGroups: readonly string[];
  locationId: string | null;
}

export const defaultVariantTableView: VariantTableView = {
  groupBy: "first",
  openGroups: [],
  locationId: null,
};

/**
 * The options worth grouping by. It takes two that each have several choices: otherwise every
 * group would hold a single variant, or there'd be one group holding them all.
 */
export function groupingChoices(options: readonly OptionDraft[]): GroupingChoice[] {
  const withChoices = options
    .map((option) => ({ name: option.name.trim(), choices: splitList(option.values).length }))
    .filter((option) => option.choices > 0);
  const choices = withChoices.flatMap((option, position) =>
    option.choices > 1 ? [{ name: option.name, position }] : [],
  );
  return choices.length > 1 ? choices : [];
}

/** The option position to group by, or null for a plain list. */
export function groupPosition(
  groupBy: VariantTableView["groupBy"],
  choices: readonly GroupingChoice[],
): number | null {
  if (groupBy === "none") return null;
  const chosen = choices.find((choice) => choice.position === groupBy);
  return (chosen ?? choices[0])?.position ?? null;
}

export function groupVariants(variants: readonly VariantDraft[], position: number): VariantGroup[] {
  const groups = new Map<string, VariantGroup>();
  variants.forEach((variant, index) => {
    const name = variant.optionValues[position] ?? "";
    const key = `${position}:${name}`;
    const group = groups.get(key) ?? { key, name, rows: [] };
    group.rows.push({ variant, index });
    groups.set(key, group);
  });
  return [...groups.values()];
}

/** A variant's name without the group's value, as the group row already shows that. */
export function nameInGroup(variant: VariantDraft, position: number | null): string {
  return variant.optionValues.filter((_, index) => index !== position).join(" / ");
}

/** The text every box shares, or nothing when they differ. */
export function sharedText(texts: readonly string[]): string {
  const [first = ""] = texts;
  return texts.every((text) => text === first) ? first : "";
}

/** What the stock box shows: nothing while the variant's stock isn't being counted. */
export function stockText(variant: VariantDraft, locationId: string): string {
  return variant.inventoryTracked ? (variant.stock[locationId] ?? "") : "";
}

/** A typed stock level. Typing a number means the owner wants this variant's stock counted. */
export function withStock(variant: VariantDraft, locationId: string, text: string): VariantDraft {
  return {
    ...variant,
    inventoryTracked: variant.inventoryTracked || text.trim() !== "",
    stock: { ...variant.stock, [locationId]: text },
  };
}

export interface StockTotal {
  inStock: number;
  /** How many variants can always be bought, because their stock isn't counted. */
  notCounted: number;
}

/** Stock across every location, leaving out boxes that don't hold a number yet. */
export function totalStock(
  variants: readonly VariantDraft[],
  locationIds: readonly string[],
): StockTotal {
  let inStock = 0;
  let notCounted = 0;
  for (const variant of variants) {
    if (!variant.inventoryTracked) {
      notCounted += 1;
      continue;
    }
    for (const locationId of locationIds) {
      const onHand = Number(variant.stock[locationId] ?? 0);
      if (Number.isInteger(onHand)) inStock += onHand;
    }
  }
  return { inStock, notCounted };
}

/** The saving problems for one variant, whichever box they belong to. */
export function variantProblems(errors: Record<string, string>, index: number): string[] {
  const prefix = `variants.${index}.`;
  const messages = Object.entries(errors)
    .filter(([field]) => field.startsWith(prefix))
    .map(([, message]) => message);
  return [...new Set(messages)];
}
