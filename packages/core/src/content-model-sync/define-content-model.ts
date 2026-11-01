import type { CollectionStructure } from "../collections/collections.schema.js";
import type { FieldSpec } from "./field-helpers.js";

/**
 * The definitions a content model file exports, one per file:
 *
 *   export default defineContentType({ handle: "post", name: "Blog post", fields: { ... } });
 *
 * The `define...` functions only add `kind` and return their argument, so the types do all
 * the work: an unknown option or a missing `taxonomy` is an error in the editor, before
 * Lintel ever reads the file.
 */

/** Where a content type's entries live, and how they're arranged. */
export interface CollectionDefinition {
  /** Used in the delivery API's addresses (`/delivery/posts`). Can't be changed later without moving entries. */
  handle: string;
  /** What editors see in the Content section, such as "Blog posts". */
  name: string;
  /**
   * How entries are arranged: `"tree"` for pages with parents and children, `"dated"` for
   * posts by date, `"flat"` for a simple list ordered by hand.
   */
  structure: CollectionStructure;
  /**
   * Where an entry lives on the site, using `{slug}` and optionally `{year}`, `{month}`,
   * `{day}`: `"/blog/{slug}"`. `null` means entries have no page of their own.
   * Defaults to `/<handle>/{slug}`.
   */
  route?: string | null;
}

export interface ContentTypeInput {
  /** Lowercase letters, numbers and underscores. Collections and code refer to it, so it can't change. */
  handle: string;
  /** What editors see, such as "Blog post". */
  name: string;
  /** The collection, or collections, whose entries use these fields. */
  collection?: CollectionDefinition | CollectionDefinition[];
  /**
   * The fields, keyed by handle, in the order editors see them. The first has to be
   * `title: text()`, which every entry has.
   */
  fields: Record<string, FieldSpec>;
}

export interface ContentTypeDefinition extends ContentTypeInput {
  kind: "contentType";
}

export interface TaxonomyInput {
  /** Used by terms fields (`terms({ taxonomy: "categories" })`) and the delivery API. */
  handle: string;
  /** What editors see, such as "Categories". */
  name: string;
}

export interface TaxonomyDefinition extends TaxonomyInput {
  kind: "taxonomy";
}

export interface GlobalSetInput {
  /** Used by the delivery API (`/delivery/globals/site_settings`). */
  handle: string;
  /** What editors see, such as "Site settings". */
  name: string;
  /** The fields, keyed by handle, in the order editors see them. */
  fields: Record<string, FieldSpec>;
}

export interface GlobalSetDefinition extends GlobalSetInput {
  kind: "globalSet";
}

export interface MenuInput {
  /** Used by the delivery API (`/delivery/navigation/main`). */
  handle: string;
  /** What editors see, such as "Main menu". */
  name: string;
  /** How many levels of drop-downs the menu can have, from 1 to 5. Defaults to 3. */
  maxDepth?: number;
}

export interface MenuDefinition extends MenuInput {
  kind: "menu";
}

/** Anything a content model file can define. Menus hold their items in the database, as content. */
export type ModelDefinition =
  ContentTypeDefinition | TaxonomyDefinition | GlobalSetDefinition | MenuDefinition;

/** A kind of content, such as a page or a blog post: its fields and where its entries live. */
export function defineContentType(input: ContentTypeInput): ContentTypeDefinition {
  return { kind: "contentType", ...input };
}

/** A way of grouping content, such as Categories or Tags. Its terms are content, kept in the database. */
export function defineTaxonomy(input: TaxonomyInput): TaxonomyDefinition {
  return { kind: "taxonomy", ...input };
}

/** Fields with one value for the whole site, such as "Site settings". */
export function defineGlobalSet(input: GlobalSetInput): GlobalSetDefinition {
  return { kind: "globalSet", ...input };
}

/** A navigation menu. Its items are content, edited in the admin. */
export function defineMenu(input: MenuInput): MenuDefinition {
  return { kind: "menu", ...input };
}
