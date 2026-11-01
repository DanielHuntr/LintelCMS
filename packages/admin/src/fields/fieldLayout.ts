import type { EntryData, Field, FieldWidth } from "./field.types.js";

/**
 * How fields are laid out in the entry editor: on a 12-column grid, each as wide as its
 * `width` setting, split into tabs by Tab fields. Plain functions, so the rules are easy to
 * test and the blueprint builder's preview lays fields out exactly as editors will see them.
 */

/**
 * The grid classes for each width. On a narrow editor (a phone, or beside the preview) every
 * field takes the whole row; from 36rem of room the widths apply. Written out in full so
 * Tailwind finds them.
 */
const widthClasses: Record<FieldWidth, string> = {
  25: "col-span-12 @xl:col-span-3",
  33: "col-span-12 @xl:col-span-4",
  50: "col-span-12 @xl:col-span-6",
  66: "col-span-12 @xl:col-span-8",
  75: "col-span-12 @xl:col-span-9",
  100: "col-span-12",
};

export function widthClass(width: FieldWidth | undefined): string {
  return widthClasses[width ?? 100];
}

/** Twelfths of the row, for the builder's resize handle. */
export const columnsForWidth: Record<FieldWidth, number> = {
  25: 3,
  33: 4,
  50: 6,
  66: 8,
  75: 9,
  100: 12,
};

/** The width nearest to a number of twelfths, for dragging a field's edge. */
export function widthNearestColumns(columns: number): FieldWidth {
  const widths = Object.entries(columnsForWidth) as unknown as [string, number][];
  let best: FieldWidth = 100;
  let bestDistance = Infinity;
  for (const [width, span] of widths) {
    const distance = Math.abs(span - columns);
    if (distance < bestDistance) {
      best = Number(width) as FieldWidth;
      bestDistance = distance;
    }
  }
  return best;
}

export interface FieldTab {
  /** The Tab field that starts it, or null for the fields before the first tab. */
  tab: Field | null;
  fields: Field[];
}

/**
 * Fields split into tabs: a Tab field starts a new one. Fields before the first Tab field
 * make a first tab of their own (named "Main" by the editor). Without any Tab fields there
 * is one tab with everything, and no tab bar is shown.
 */
export function splitIntoTabs<Item extends Pick<Field, "type">>(
  fields: readonly Item[],
): { tab: Item | null; fields: Item[] }[] {
  const tabs: { tab: Item | null; fields: Item[] }[] = [{ tab: null, fields: [] }];
  for (const field of fields) {
    if (field.type === "tab") {
      tabs.push({ tab: field, fields: [] });
    } else {
      tabs.at(-1)?.fields.push(field);
    }
  }
  // An empty first tab (the form starts with a Tab field) isn't worth showing.
  return tabs[0]?.fields.length === 0 && tabs.length > 1 ? tabs.slice(1) : tabs;
}

/** Fieldtypes whose value can be set as a default in the builder. */
const typesWithDefaults = new Set<string>([
  "text",
  "textarea",
  "markdown",
  "number",
  "range",
  "toggle",
  "select",
  "radio",
  "checkboxes",
  "buttonGroup",
  "date",
  "time",
  "colour",
  "email",
  "url",
  "slug",
  "code",
  "icon",
  "hidden",
  "list",
  "revealer",
]);

export function canHaveDefault(field: Pick<Field, "type">): boolean {
  return typesWithDefaults.has(field.type);
}

/** Fieldtypes with a placeholder: those with a text box. */
const typesWithPlaceholders = new Set<string>([
  "text",
  "textarea",
  "markdown",
  "number",
  "email",
  "url",
  "slug",
  "code",
]);

export function canHavePlaceholder(field: Pick<Field, "type">): boolean {
  return typesWithPlaceholders.has(field.type);
}

/** The values a new entry starts with: each field's default, inside groups too. */
export function defaultValues(fields: readonly Field[]): EntryData {
  const data: EntryData = {};
  for (const field of fields) {
    if (field.default !== undefined && field.default !== null) {
      data[field.handle] = field.default;
    } else if (field.type === "group" || field.type === "fieldset") {
      const inner = defaultValues(field.options.fields ?? []);
      if (Object.keys(inner).length > 0) data[field.handle] = inner;
    }
  }
  return data;
}
