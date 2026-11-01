import { createHash } from "node:crypto";
import {
  type ContentModel,
  canonicalJson,
  type ModelUnit,
  sameUnit,
} from "./content-model.schema.js";

/**
 * Deciding, unit by unit, which side wins when the files and the database disagree.
 *
 * In production the files always win: they are what was deployed. In development both
 * sides can change, so each unit's last synced version (its "base", kept as a hash) tells
 * which one moved:
 *
 *   - only the file changed      → the file is applied to the database;
 *   - only the database changed  → the file is rewritten (someone used the admin);
 *   - both changed               → the file wins, and the admin is told (a conflict);
 *   - never synced before        → the file wins if there is one, otherwise the
 *                                  database's version is written to a new file.
 */

export type UnitHashes = Readonly<Record<string, string>>;

export interface SyncPlan {
  /** What the database should become, before any destructive change is held back. */
  databaseTarget: Map<string, ModelUnit>;
  /** Units whose file should be rewritten from the database, or deleted (undefined). */
  fileUpdates: Map<string, ModelUnit | undefined>;
  /** Units changed on both sides; the file's version was taken. */
  conflicts: string[];
  /** Units already the same on both sides. */
  inSync: string[];
}

export function hashUnit(unit: ModelUnit | undefined): string | undefined {
  return unit === undefined
    ? undefined
    : createHash("sha256").update(canonicalJson(unit)).digest("hex").slice(0, 16);
}

/** `base` is null in production, where the files always win. */
export function planSync(
  fromFiles: ContentModel,
  fromDatabase: ContentModel,
  base: UnitHashes | null,
): SyncPlan {
  const plan: SyncPlan = {
    databaseTarget: new Map(fromDatabase),
    fileUpdates: new Map(),
    conflicts: [],
    inSync: [],
  };

  for (const key of new Set([...fromFiles.keys(), ...fromDatabase.keys()])) {
    const file = fromFiles.get(key);
    const stored = fromDatabase.get(key);
    if (sameUnit(file, stored)) {
      plan.inSync.push(key);
      continue;
    }
    const winner = base === null ? "file" : decideWinner(key, file, stored, base, plan);
    if (winner === "file") {
      setOrDelete(plan.databaseTarget, key, file);
    } else {
      plan.fileUpdates.set(key, stored);
    }
  }
  return plan;
}

function decideWinner(
  key: string,
  file: ModelUnit | undefined,
  stored: ModelUnit | undefined,
  base: UnitHashes,
  plan: SyncPlan,
): "file" | "database" {
  const synced = base[key];
  if (synced === undefined) {
    return file ? "file" : "database";
  }
  const fileChanged = hashUnit(file) !== synced;
  const databaseChanged = hashUnit(stored) !== synced;
  if (fileChanged && databaseChanged) {
    plan.conflicts.push(key);
    return "file";
  }
  return databaseChanged ? "database" : "file";
}

function setOrDelete(model: Map<string, ModelUnit>, key: string, unit: ModelUnit | undefined) {
  if (unit) {
    model.set(key, unit);
  } else {
    model.delete(key);
  }
}

/**
 * The bases to keep after a sync: what each unit now is on both sides. Units that were
 * held back keep their old base, so they still count as changed in the file next time.
 */
export function nextBase(
  previous: UnitHashes,
  appliedTarget: ContentModel,
  heldBack: ReadonlySet<string>,
  keys: Iterable<string>,
): Record<string, string> {
  const base: Record<string, string> = {};
  for (const key of keys) {
    const hash = heldBack.has(key) ? previous[key] : hashUnit(appliedTarget.get(key));
    if (hash !== undefined) {
      base[key] = hash;
    }
  }
  return base;
}
