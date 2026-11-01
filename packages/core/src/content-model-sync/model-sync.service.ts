import { randomUUID } from "node:crypto";
import { type FSWatcher, watch } from "node:fs";
import type { Database } from "../database/client.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";
import { applyModel } from "./apply-model.service.js";
import {
  type ContentModel,
  describeUnitKind,
  modelFromUnits,
  sortedUnits,
} from "./content-model.schema.js";
import {
  ContentModelProblemsError,
  NoPendingModelChangesError,
} from "./content-model-sync.errors.js";
import { readModelFromDatabase } from "./model-database.js";
import { diffModels } from "./model-diff.js";
import {
  deleteUnitFile,
  type ModelFileFormat,
  modelFolderExists,
  pathForUnit,
  readModelFolder,
  writeUnitFile,
} from "./model-files.js";
import { type AssessedChange, assessChanges } from "./model-impact.js";
import type { ModelEvents } from "./model-events.js";
import { nextBase, planSync } from "./model-sync-plan.js";

/**
 * Keeps the content model folder and the database in step while the server runs.
 *
 * - Development: two-way. The folder is watched and file edits are applied as they're
 *   saved; changes made in the admin are written to the files (the routes nudge
 *   `requestSync` after each change). See model-sync-plan.ts for who wins when both moved.
 * - Production: the files win, once at startup. Changes that would delete content wait
 *   for someone to confirm them in the admin, or for `model push --allow-data-loss`.
 *
 * Either way a change that would delete content is never made without that confirmation:
 * the unit it belongs to is held back, and listed in `status().pending` with what it
 * would delete. Nothing happens at all while the folder doesn't exist.
 */

export type SyncMode = "development" | "production";

export interface ContentModelOptions {
  /** The absolute path of the content model folder. */
  folder: string;
  /** How the folder is named to people, such as "content-model". */
  folderLabel: string;
  mode: SyncMode;
  /** Whether content types and the rest can be changed in the admin while managed in code. */
  editableInAdmin: boolean;
  /** The format of new files. Existing files keep theirs. */
  format: ModelFileFormat;
  /** Watch the folder for edits. On in development unless turned off (tests sync by hand). */
  watch?: boolean;
}

export interface ModelSyncNotice {
  id: string;
  message: string;
  createdAt: string;
}

export interface ModelSyncStatus {
  managedInCode: boolean;
  editableInAdmin: boolean;
  folder: string;
  mode: SyncMode;
  /** Changes in the files that wait for a confirmation, because they'd delete content. */
  pending: AssessedChange[];
  notices: ModelSyncNotice[];
  /** What's wrong with the files, when they can't be used. */
  problems: string[];
}

export interface SyncResult {
  databaseChanged: boolean;
  filesWritten: string[];
  pending: AssessedChange[];
}

const SYNC_DELAY_MILLISECONDS = 150;
const MOST_NOTICES = 20;

export class ContentModelSync {
  private pending: AssessedChange[] = [];
  private problems: string[] = [];
  private notices: ModelSyncNotice[] = [];
  private watcher: FSWatcher | undefined;
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<unknown> = Promise.resolve();

  constructor(
    readonly options: ContentModelOptions,
    private readonly database: () => Database,
    private readonly events: ModelEvents,
    private readonly log: {
      info(message: string): void;
      error(error: unknown, message: string): void;
    },
  ) {}

  isManagedInCode(): boolean {
    return modelFolderExists(this.options.folder);
  }

  /** Schema editing is switched off in the admin. */
  isLocked(): boolean {
    return this.isManagedInCode() && !this.options.editableInAdmin;
  }

  async start(): Promise<void> {
    if (!this.isManagedInCode()) {
      return;
    }
    await this.syncAndLog();
    if (this.options.mode === "development" && (this.options.watch ?? true)) {
      this.watcher = watch(this.options.folder, { recursive: true }, () => this.requestSync());
      this.watcher.on("error", (error) =>
        this.log.error(error, "Watching the content model folder stopped"),
      );
    }
  }

  stop(): void {
    clearTimeout(this.timer);
    this.watcher?.close();
  }

  /** Syncs shortly, once, however many times it is asked in quick succession. */
  requestSync(): void {
    if (this.options.mode !== "development" || !this.isManagedInCode()) {
      return;
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.syncAndLog(), SYNC_DELAY_MILLISECONDS);
  }

  /** Runs one sync after any that is already running, never two at once. */
  sync(options: { allowDataLoss?: boolean } = {}): Promise<SyncResult> {
    const next = this.running.then(() => this.syncNow(options.allowDataLoss ?? false));
    this.running = next.catch(() => undefined);
    return next;
  }

  /** Applies what was waiting for a confirmation, deleting the content it said it would. */
  async applyPending(): Promise<ModelSyncStatus> {
    if (this.pending.length === 0) {
      throw new NoPendingModelChangesError();
    }
    await this.sync({ allowDataLoss: true });
    return this.status();
  }

  dismissNotice(noticeId: string): void {
    this.notices = this.notices.filter((notice) => notice.id !== noticeId);
    this.events.publish("status-changed");
  }

  status(): ModelSyncStatus {
    return {
      managedInCode: this.isManagedInCode(),
      editableInAdmin: !this.isLocked(),
      folder: this.options.folderLabel,
      mode: this.options.mode,
      pending: this.pending,
      notices: this.notices,
      problems: this.problems,
    };
  }

  private async syncAndLog(): Promise<void> {
    try {
      const result = await this.sync();
      if (result.pending.length > 0 && this.options.mode === "production") {
        this.log.info(
          `The content model in ${this.options.folderLabel} has changes that would delete content, ` +
            "so they haven't been made. Confirm them in the admin (Settings, then Content types), " +
            "or run `lintel model push --allow-data-loss`.",
        );
      }
    } catch (error) {
      this.log.error(error, "Syncing the content model failed");
    }
  }

  private async syncNow(allowDataLoss: boolean): Promise<SyncResult> {
    const result: SyncResult = { databaseChanged: false, filesWritten: [], pending: [] };
    if (!this.isManagedInCode()) {
      return result;
    }
    const folder = await this.readFolderOrRecordProblems();
    if (!folder) {
      return result;
    }

    const database = this.database();
    const fromDatabase = await readModelFromDatabase(database);
    const isDevelopment = this.options.mode === "development";
    const base = isDevelopment ? await readSetting(database, "contentModelSyncBase") : null;
    const plan = planSync(folder.model, fromDatabase, base);

    const changes = diffModels(fromDatabase, plan.databaseTarget);
    const assessed = await assessChanges(database, changes);
    const heldBack = new Set(
      allowDataLoss
        ? []
        : assessed.filter((change) => change.destructive).flatMap((change) => change.unitKeys),
    );
    const applied = withHeldBackUnits(plan.databaseTarget, fromDatabase, heldBack);
    if (diffModels(fromDatabase, applied).length > 0) {
      await applyModel(database, fromDatabase, applied);
      result.databaseChanged = true;
    }

    if (isDevelopment) {
      result.filesWritten = await this.writeFiles(plan.fileUpdates, folder.paths);
      const keys = new Set([...folder.model.keys(), ...fromDatabase.keys(), ...applied.keys()]);
      await writeSetting(
        database,
        "contentModelSyncBase",
        nextBase(base ?? {}, applied, heldBack, keys),
      );
    }

    this.recordConflicts(
      plan.conflicts.filter((key) => !heldBack.has(key)),
      applied,
      folder.sources,
    );
    result.pending = assessed.filter((change) => change.unitKeys.some((key) => heldBack.has(key)));
    this.pending = result.pending;
    this.problems = [];
    if (result.databaseChanged) {
      this.events.publish("model-changed");
    }
    this.events.publish("status-changed");
    return result;
  }

  private async readFolderOrRecordProblems() {
    try {
      return await readModelFolder(this.options.folder);
    } catch (error) {
      if (!(error instanceof ContentModelProblemsError)) {
        throw error;
      }
      this.problems = [...error.problems];
      this.events.publish("status-changed");
      return undefined;
    }
  }

  private async writeFiles(
    updates: ReadonlyMap<string, ReturnType<ContentModel["get"]>>,
    paths: ReadonlyMap<string, string>,
  ): Promise<string[]> {
    const written: string[] = [];
    for (const [key, unit] of updates) {
      if (unit === undefined) {
        const path = paths.get(key);
        if (path) {
          await deleteUnitFile(path);
          written.push(path);
        }
        continue;
      }
      const path = pathForUnit(this.options.folder, unit, paths, this.options.format);
      if (await writeUnitFile(this.options.folder, path, unit)) {
        written.push(path);
      }
    }
    return written;
  }

  private recordConflicts(
    keys: string[],
    applied: ContentModel,
    sources: ReadonlyMap<string, string>,
  ) {
    for (const key of keys) {
      const unit = applied.get(key);
      const name = unit ? `The ${describeUnitKind(unit.kind)} ${unit.name}` : key;
      const file = sources.get(key) ?? this.options.folderLabel;
      this.notices = [
        {
          id: randomUUID(),
          message:
            `${name} was changed here and in ${this.options.folderLabel}/${file} at the same time. ` +
            "The version in the file was kept, so the change made here was undone.",
          createdAt: new Date().toISOString(),
        },
        ...this.notices,
      ].slice(0, MOST_NOTICES);
    }
  }
}

/** The target, with held-back units left as the database has them. */
function withHeldBackUnits(
  target: ContentModel,
  current: ContentModel,
  heldBack: ReadonlySet<string>,
): ContentModel {
  const units = sortedUnits(new Map([...current, ...target])).flatMap((unit) => {
    const key = `${unit.kind}:${unit.handle}`;
    const chosen = heldBack.has(key) ? current.get(key) : target.get(key);
    return chosen ? [chosen] : [];
  });
  return modelFromUnits(units);
}

/** What the admin shows; a server without content model options is never managed in code. */
export function contentModelStatus(sync: ContentModelSync | null): ModelSyncStatus {
  return (
    sync?.status() ?? {
      managedInCode: false,
      editableInAdmin: true,
      folder: "content-model",
      mode: "development",
      pending: [],
      notices: [],
      problems: [],
    }
  );
}
