import { pageDocumentVersion } from "./page-document.schema.js";

/**
 * Stored pages say which version of the document shape they were saved in. When the shape
 * changes, the version goes up and a migration is added here that turns the old shape into
 * the new one. Pages are migrated when they are read, so nothing has to rewrite the database,
 * and a page saved again is stored in the newest shape.
 *
 * Version 1 is the first shape, so there is nothing to migrate yet. A future migration looks
 * like this:
 *
 *   { from: 1, to: 2, describe: "Spacing moved from props into styles",
 *     migrate: (page) => ({ ...page, version: 2, root: moveSpacing(page.root) }) }
 */
export interface DocumentMigration {
  from: number;
  to: number;
  /** One line for the changelog and for error messages. */
  describe: string;
  migrate: (document: Record<string, unknown>) => Record<string, unknown>;
}

export const documentMigrations: readonly DocumentMigration[] = [];

export class UnknownPageVersionError extends Error {
  constructor(version: unknown) {
    super(
      typeof version === "number" && version > pageDocumentVersion
        ? `This page was saved by a newer version of Lintel (page version ${version}). Update Lintel to open it.`
        : `This page has a version Lintel doesn’t recognise (${String(version)}).`,
    );
    this.name = "UnknownPageVersionError";
  }
}

/**
 * Brings a stored page up to the current version, one migration at a time. Anything that
 * isn't an object with a numeric version is handed back unchanged for the schema to reject.
 */
export function migrateDocument(
  stored: unknown,
  migrations: readonly DocumentMigration[] = documentMigrations,
  currentVersion: number = pageDocumentVersion,
): unknown {
  if (!isRecord(stored) || typeof stored.version !== "number") {
    return stored;
  }
  let document: Record<string, unknown> = stored;
  while (document.version !== currentVersion) {
    const version = document.version;
    const migration = migrations.find((candidate) => candidate.from === version);
    if (!migration || typeof version !== "number" || version > currentVersion) {
      throw new UnknownPageVersionError(version);
    }
    document = { ...migration.migrate(document), version: migration.to };
  }
  return document;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
