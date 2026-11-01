import type { Blueprint } from "../content-types/blueprints.types.js";
import type { EntryData } from "../fields/field.types.js";

/** How a collection's entries are arranged. Shown to people as plain words, never these names. */
export type CollectionStructure = "tree" | "dated" | "flat";

export interface Collection {
  id: string;
  handle: string;
  name: string;
  blueprintHandle: string;
  structure: CollectionStructure;
  /** Where entries live on the site, e.g. "/blog/{slug}". */
  routePattern: string;
  /** Where the website shows drafts for live preview; null until a site is connected. */
  previewUrlPattern: string | null;
  entryCount: number;
  updatedAt: string;
}

export type EntryStatus = "draft" | "published" | "scheduled";

export interface Person {
  id: string;
  name: string;
}

/** An entry as it appears in lists. */
export interface EntrySummary {
  id: string;
  title: string;
  slug: string;
  status: EntryStatus;
  parentId: string | null;
  /** The language it's written in, such as "en-GB". */
  locale: string;
  /** The entry this one is a translation of, or null for an original. */
  originId: string | null;
  updatedAt: string;
  publishedAt: string | null;
  scheduledFor: string | null;
  updatedBy: Person | null;
  /** Fields shown as columns in the list ("Show as a column in lists"), with their values. */
  columns?: Array<{ handle: string; label: string; value: unknown }>;
}

/** A whole entry, as the editor loads it. */
export interface Entry extends EntrySummary {
  collectionHandle: string;
  data: EntryData;
  blueprint: Blueprint;
  /** Saved since it was last published: the site still shows the published version. */
  hasUnpublishedChanges: boolean;
  /** The same entry in the site's other languages. */
  translations: EntryTranslation[];
}

export interface EntryTranslation {
  id: string;
  locale: string;
  title: string;
  status: EntryStatus;
}

export interface EntryPage {
  entries: EntrySummary[];
  total: number;
  page: number;
  perPage: number;
}

export type RevisionKind = "edited" | "published" | "unpublished" | "scheduled" | "restored";

export interface Revision {
  id: string;
  kind: RevisionKind;
  createdAt: string;
  /** When it last changed: an "edited" revision gathers one person's autosaves. */
  updatedAt: string;
  /** For "restored": when the revision that was brought back was made. */
  restoredFromAt: string | null;
  author: Person | null;
}
