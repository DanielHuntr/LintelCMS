import type { Collection } from "../collections/collections.table.js";
import type { Database, DatabaseOrTransaction } from "../database/client.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import type { AssetExists } from "../fieldtypes/image-assets.js";
import type { MediaContext } from "../media/media.service.js";
import type { WordPressFieldMapping } from "./wordpress-fields.js";
import type { MediaSource } from "./wordpress-media.js";
import type { WordPressImportMapping } from "./wordpress-import.schema.js";

/** Where one kind of WordPress content goes: a collection, and which field takes what. */
export interface CollectionTarget {
  collection: Collection;
  fields: readonly FieldDefinition[];
  fieldMapping: WordPressFieldMapping;
}

/**
 * Everything the item handlers need while an import runs. `database` is the transaction
 * the current item is written in.
 */
export interface ItemContext {
  database: DatabaseOrTransaction;
  /**
   * The server's database, outside any transaction, for the few saves that open a
   * transaction of their own (shop products). Not used in a dry run.
   */
  serverDatabase: Database;
  importId: string;
  /** The old site's address, from the export: imports from the same site share it. */
  siteAddress: string;
  /** In a dry run nothing is downloaded and every write is rolled back afterwards. */
  dryRun: boolean;
  mapping: WordPressImportMapping;
  /** Who started the import: the uploader of its images. */
  startedBy: string;
  siteId: string;
  locale: string;
  posts: CollectionTarget | null;
  pages: CollectionTarget | null;
  media: MediaSource | null;
  mediaContext: (database: DatabaseOrTransaction) => MediaContext;
  assetExists: AssetExists;
  /** What items done earlier became, keyed "kind:sourceId", such as "page:20". */
  targets: Map<string, string>;
}

/** How one item went. `details` is kept for the report. */
export interface ItemResult {
  status: "done" | "skipped" | "failed";
  targetId: string | null;
  message: string | null;
  details: Record<string, unknown> | null;
}

export function done(targetId: string, details: Record<string, unknown> | null = null): ItemResult {
  return { status: "done", targetId, message: null, details };
}

export function skipped(message: string): ItemResult {
  return { status: "skipped", targetId: null, message, details: null };
}

/** Made by an earlier import; still a target, so pages under it find their parent. */
export function alreadyImported(targetId: string): ItemResult {
  return {
    status: "skipped",
    targetId,
    message: "Already brought in by an earlier import of this site, so it was left as it is.",
    details: null,
  };
}

export function failed(message: string): ItemResult {
  return { status: "failed", targetId: null, message, details: null };
}
