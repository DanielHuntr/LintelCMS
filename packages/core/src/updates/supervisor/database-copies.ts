import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { lintelFolderAt, readSavedDatabaseChoice } from "../../database/database-choice.js";
import { lockDataFolder } from "../../database/data-folder-lock.js";
import { databaseCopiesFolder, databaseCopyExists } from "../install-home.js";

/**
 * Exact copies of the built-in database, so a failed update or a roll back can put the
 * database back as it was before the switch: its tables as well as its rows. (Restoring a
 * backup's rows into the newer tables leaves the older version running on tables it
 * doesn't know; see docs/decisions/0041-going-back-a-version.md.)
 *
 * The built-in database is a folder (PGlite's data folder). The supervisor copies it only
 * while no server runs, holding the folder's lock, so the copy is never taken mid-write:
 *
 *   versions/database-copies/<id>/data/        the folder as it was
 *   versions/database-copies/<id>/copy.json    written last: the copy is complete
 *
 * A Postgres server can't be copied like this. There, one-click updates that change the
 * database are refused instead (see supervisor.ts), and nothing here is used.
 */

export interface DatabaseCopies {
  /** Copies the database as it is now. Resolves with the copy's id. */
  take(label: { fromVersion: string; toVersion: string }): Promise<string>;
  /** Puts the database back exactly as the copy has it. Safe to run again if cut off. */
  restore(copyId: string): Promise<void>;
}

/** Where the database the server uses lives, worked out the way the server does. */
export type DatabaseLocation =
  | { kind: "built-in"; dataFolder: string }
  | { kind: "postgres"; chosenBy: "environment" | "setup" };

export function locateDatabase(
  environment: NodeJS.ProcessEnv,
  lintelFolder: string,
): DatabaseLocation {
  if (environment.DATABASE_URL) {
    return { kind: "postgres", chosenBy: "environment" };
  }
  const folder = lintelFolderAt(lintelFolder);
  const choice = readSavedDatabaseChoice(folder);
  if (choice?.kind === "postgres") {
    return { kind: "postgres", chosenBy: "setup" };
  }
  return { kind: "built-in", dataFolder: folder.dataFolder };
}

const copyInformationSchema = z.object({
  id: z.string(),
  fromVersion: z.string(),
  toVersion: z.string(),
  takenAt: z.string(),
});

/** How many copies are kept; older ones are removed when a new one is taken. */
export const DATABASE_COPIES_KEPT = 3;

export class FolderDatabaseCopies implements DatabaseCopies {
  constructor(
    private readonly home: string,
    private readonly dataFolder: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async take(label: { fromVersion: string; toVersion: string }): Promise<string> {
    const takenAt = this.now();
    const id = `${takenAt.toISOString().replace(/[:.]/g, "-")}-${label.fromVersion}-to-${label.toVersion}`;
    const folder = join(databaseCopiesFolder(this.home), id);
    await rm(folder, { recursive: true, force: true });
    await mkdir(folder, { recursive: true });
    await this.whileLocked(async () => {
      if (existsSync(this.dataFolder)) {
        await cp(this.dataFolder, join(folder, "data"), { recursive: true });
      } else {
        await mkdir(join(folder, "data"));
      }
    });
    await writeFile(
      join(folder, "copy.json"),
      JSON.stringify({ id, ...label, takenAt: takenAt.toISOString() }, null, 2),
    );
    await this.removeOldCopies(id);
    return id;
  }

  async restore(copyId: string): Promise<void> {
    if (!databaseCopyExists(this.home, copyId)) {
      throw new Error("The copy of the database made before the switch isn't there any more");
    }
    const source = join(databaseCopiesFolder(this.home), copyId, "data");
    const incoming = `${this.dataFolder}.restoring`;
    const outgoing = `${this.dataFolder}.replaced`;
    await this.whileLocked(async () => {
      // Each step can be run again: the copy itself is never changed.
      await rm(incoming, { recursive: true, force: true });
      await cp(source, incoming, { recursive: true });
      await rm(outgoing, { recursive: true, force: true });
      if (existsSync(this.dataFolder)) {
        await rename(this.dataFolder, outgoing);
      }
      await rename(incoming, this.dataFolder);
      await rm(outgoing, { recursive: true, force: true });
    });
  }

  /** The copies kept, newest first. */
  async list(): Promise<Array<z.infer<typeof copyInformationSchema>>> {
    const folder = databaseCopiesFolder(this.home);
    if (!existsSync(folder)) {
      return [];
    }
    const copies = [];
    for (const name of await readdir(folder)) {
      try {
        const information = copyInformationSchema.parse(
          JSON.parse(await readFile(join(folder, name, "copy.json"), "utf8")),
        );
        copies.push(information);
      } catch {
        // Not finished (cut off while copying): removed below or by the next copy.
      }
    }
    return copies.sort((left, right) => right.takenAt.localeCompare(left.takenAt));
  }

  /** Holding the lock means no server has the database open while it's copied or replaced. */
  private async whileLocked(work: () => Promise<void>): Promise<void> {
    await mkdir(join(this.dataFolder, ".."), { recursive: true });
    const lock = lockDataFolder(`${this.dataFolder}.lock`);
    try {
      await work();
    } finally {
      lock.release();
    }
  }

  private async removeOldCopies(keep: string): Promise<void> {
    const kept = new Set((await this.list()).slice(0, DATABASE_COPIES_KEPT).map((copy) => copy.id));
    kept.add(keep);
    for (const name of await readdir(databaseCopiesFolder(this.home))) {
      if (!kept.has(name)) {
        await rm(join(databaseCopiesFolder(this.home), name), { recursive: true, force: true });
      }
    }
  }
}
