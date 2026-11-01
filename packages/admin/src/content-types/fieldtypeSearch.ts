import type { FieldType } from "../fields/field.types.js";
import {
  fieldtypeCategories,
  type FieldtypeCategory,
  type FieldtypeDescription,
} from "./blueprints.types.js";

/**
 * Finding a fieldtype in "Add a field": by its name, its description or the other words
 * people use for it ("dropdown" finds Select, "wysiwyg" finds Rich text). Plain functions,
 * so the picker's rules can be tested without drawing it.
 */

/** Fieldtypes from older servers or plugins may not say where they belong. */
export function categoryOf(fieldtype: Pick<FieldtypeDescription, "category">): FieldtypeCategory {
  return fieldtypeCategories.includes(fieldtype.category) ? fieldtype.category : "advanced";
}

/**
 * The fieldtypes matching what was typed, best first: names that start with it, then names
 * containing it, then other words for it, then descriptions. Every word typed has to match.
 */
export function searchFieldtypes(
  fieldtypes: readonly FieldtypeDescription[],
  query: string,
): FieldtypeDescription[] {
  const words = normalise(query).split(" ").filter(Boolean);
  if (words.length === 0) return [...fieldtypes];
  return fieldtypes
    .map((fieldtype, index) => ({ fieldtype, index, score: matchScore(fieldtype, words) }))
    .filter((match) => match.score > 0)
    .sort((first, second) => second.score - first.score || first.index - second.index)
    .map((match) => match.fieldtype);
}

function matchScore(fieldtype: FieldtypeDescription, words: readonly string[]): number {
  const name = normalise(fieldtype.name);
  const type = normalise(fieldtype.type);
  const keywords = (fieldtype.keywords ?? []).map(normalise);
  const description = normalise(fieldtype.description);
  let total = 0;
  for (const word of words) {
    const score = Math.max(
      name.startsWith(word) || type.startsWith(word) ? 40 : 0,
      name.includes(word) ? 30 : 0,
      keywords.some((keyword) => keyword.startsWith(word)) ? 20 : 0,
      keywords.some((keyword) => keyword.includes(word)) ? 15 : 0,
      description.includes(word) ? 5 : 0,
    );
    if (score === 0) return 0;
    total += score;
  }
  return total;
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The fieldtypes in one category, in the server's order. */
export function fieldtypesIn(
  fieldtypes: readonly FieldtypeDescription[],
  category: FieldtypeCategory,
): FieldtypeDescription[] {
  return fieldtypes.filter((fieldtype) => categoryOf(fieldtype) === category);
}

/** The categories that have at least one fieldtype, in order. */
export function categoriesWithFieldtypes(
  fieldtypes: readonly FieldtypeDescription[],
): FieldtypeCategory[] {
  return fieldtypeCategories.filter((category) => fieldtypesIn(fieldtypes, category).length > 0);
}

/**
 * Where the highlight goes for an arrow key in a grid of `count` items, `columns` across.
 * Up and down move a row; left and right one item. It stops at the ends rather than wrapping.
 */
export function gridTargetIndex(
  key: string,
  index: number,
  count: number,
  columns: number,
): number | undefined {
  if (count === 0) return undefined;
  const moves: Record<string, number> = {
    ArrowDown: columns,
    ArrowUp: -columns,
    ArrowRight: 1,
    ArrowLeft: -1,
  };
  const move = moves[key];
  if (move === undefined) return undefined;
  if (index < 0) return 0;
  const target = index + move;
  return target < 0 || target >= count ? index : target;
}

const RECENT_KEY = "lintel.recentFieldtypes";
const MOST_RECENT = 6;

/** The fieldtypes this browser added most recently, newest first. */
export function readRecentFieldtypes(): FieldType[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(stored)
      ? stored.filter((type): type is FieldType => typeof type === "string")
      : [];
  } catch {
    return [];
  }
}

export function rememberFieldtype(type: FieldType): void {
  const recent = [type, ...readRecentFieldtypes().filter((other) => other !== type)];
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MOST_RECENT)));
  } catch {
    // Private browsing can refuse storage; the picker works without it.
  }
}
