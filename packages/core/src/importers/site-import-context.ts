import type { Database, DatabaseOrTransaction } from "../database/client.js";
import type { AssetExists } from "../fieldtypes/image-assets.js";
import type { MediaContext } from "../media/media.service.js";
import type { MediaSource } from "../wordpress-import/wordpress-media.js";
import type { ImportSource, SiteImportFound, SiteImportMapping } from "./site-import.schema.js";

/**
 * Everything the item handlers need while an import runs. `database` is the transaction
 * the current item is written in. How each item went is an `ItemResult`, the same as the
 * WordPress importer's (see src/wordpress-import/wordpress-import-context.ts).
 */
export interface SiteItemContext {
  database: DatabaseOrTransaction;
  serverDatabase: Database;
  importId: string;
  source: ImportSource;
  /** The old site's address: imports of the same site share it. */
  siteAddress: string;
  dryRun: boolean;
  mapping: SiteImportMapping;
  found: SiteImportFound;
  /** Who started the import: the uploader of its pictures. */
  startedBy: string;
  siteId: string;
  locale: string;
  media: MediaSource | null;
  mediaContext: (database: DatabaseOrTransaction) => MediaContext;
  assetExists: AssetExists;
  /** What items done earlier became, keyed "kind:sourceId", such as "entry:about". */
  targets: Map<string, string>;
}
