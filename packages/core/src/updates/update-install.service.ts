import { existsSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { backupsContextFor, makeBackup } from "../backups/backups.service.js";
import { isOwner } from "../roles/roles.service.js";
import { recordSecurityEvent, type RequestOrigin } from "../security-log/security-log.service.js";
import { readSetting } from "../settings/settings.service.js";
import {
  currentLink,
  currentTarget,
  databaseDiffers,
  listInstalledVersions,
  versionFolder,
} from "./install-home.js";
import { prepareRelease } from "./release-download.js";
import { compareVersions } from "./semantic-version.js";
import {
  AlreadyRunningVersionError,
  OneClickNotAvailableError,
  OwnersOnlyError,
  ReleaseNotAvailableError,
  RollbackNeedsDatabaseCopyError,
  UpdateAlreadyRunningError,
  UpdateNeedsAnotherFirstError,
  UpdaterUnreachableError,
  VersionNotInstalledError,
} from "./updates.errors.js";
import type { AvailableRelease, UpdateProgress, UpdateStepId } from "./updates.schema.js";
import type { UpdatesRuntime } from "./updates-runtime.js";

/**
 * The Update and Roll back buttons. Only owners may press them; each press is written to
 * the security log. The work runs in the background and reports each step to
 * `server.updates`, which the admin follows live:
 *
 *   update     download → check signature and checksum → unpack → backup → hand over to
 *              the supervisor (process installs), which copies the database once the site
 *              is paused; or backup → hand over to lintel-updater (Docker)
 *   roll back  hand over to the supervisor, saying whether to put the database back as it
 *              was before the update (required when the newer version changed it)
 *
 * Everything that changes the running version happens in the supervisor (see supervisor/).
 */
export interface Actor {
  id: string;
  name: string;
  email: string;
}

export async function startUpdate(
  server: FastifyInstance,
  actor: Actor,
  version: string,
  origin: RequestOrigin,
): Promise<UpdateProgress> {
  const updates = server.updates;
  await requireOwner(server, actor);
  if (!updates.method.oneClick) {
    throw new OneClickNotAvailableError();
  }
  if (updates.isBusy) {
    throw new UpdateAlreadyRunningError();
  }
  const release = (await readSetting(server.database, "updateCheck")).releases.find(
    (candidate) => candidate.version === version,
  );
  if (!release || compareVersions(release.version, updates.currentVersion) <= 0) {
    throw new ReleaseNotAvailableError(version);
  }
  if (
    release.minimumVersion &&
    compareVersions(updates.currentVersion, release.minimumVersion) < 0
  ) {
    throw new UpdateNeedsAnotherFirstError(release.version, release.minimumVersion);
  }

  await recordSecurityEvent(server.database, {
    kind: "lintel-update-started",
    actor: { id: actor.id, email: actor.email },
    origin,
    details: { from: updates.currentVersion, to: release.version },
  });
  const progress = progressReporter(updates, release.version, "update");
  const first =
    updates.method.installType === "docker"
      ? progress("backing-up", "Making a backup of the whole site first.")
      : progress("downloading", stepMessages.downloading, 0);
  void runUpdate(server, actor, release, progress);
  return first;
}

async function runUpdate(
  server: FastifyInstance,
  actor: Actor,
  release: AvailableRelease,
  progress: ProgressReporter,
): Promise<void> {
  const updates = server.updates;
  try {
    if (updates.method.installType === "docker") {
      await backUpFirst(server, actor, progress);
      progress("restarting", "Asking lintel-updater to install the new version.");
      await askDockerUpdater(updates, release.version);
      progress(
        "restarting",
        "The new version is being built. Lintel restarts by itself when it's ready, in a few minutes.",
      );
      return;
    }

    const folder = await prepareRelease(
      {
        home: updates.home,
        publicKey: updates.publicKey,
        fetch: updates.fetch,
        unpack: updates.unpack,
        onProgress: (step, fraction) => progress(step, stepMessages[step], fraction),
      },
      release,
    );
    const running = await currentTarget(updates.home, updates.installFolder);
    if (server.activeDatabase.kind !== "built-in" && (await databaseDiffers(folder, running))) {
      throw new Error(
        `Lintel ${release.version} changes the database, and on a database server Lintel can't ` +
          "keep a copy to go back to if the update fails. Nothing was changed. Make a backup " +
          "with your database provider, then update by hand (see “Updating Lintel”).",
      );
    }
    // Made after the download, so it is as recent as it can be. The supervisor also copies
    // the built-in database once the site is paused; that copy is what a failed update
    // puts back.
    const backupFile = await backUpFirst(server, actor, progress);
    progress("maintenance", "Restarting Lintel with the new version.");
    updates.askSupervisor({
      kind: "update",
      version: release.version,
      backupFile,
      restoreBackupFirst: false,
      databaseCopy: null,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    progress("failed", reason, null, true);
    server.log.error(error, "Updating Lintel didn't work");
  }
}

async function backUpFirst(
  server: FastifyInstance,
  actor: Actor,
  progress: ProgressReporter,
): Promise<string> {
  progress("backing-up", "Making a backup of the whole site.");
  const backupsContext = backupsContextFor(server);
  const backup = await makeBackup(backupsContext, "before-update", actor.name);
  progress.backup(backup.filename);
  return join(backupsContext.folder, backup.filename);
}

const stepMessages = {
  downloading: "Downloading the new version.",
  verifying: "Checking the download is a genuine Lintel release.",
  unpacking: "Unpacking the new version beside the one running.",
} as const;

export async function startRollback(
  server: FastifyInstance,
  actor: Actor,
  request: { version: string; restoreBackup: boolean },
  origin: RequestOrigin,
): Promise<UpdateProgress> {
  const updates = server.updates;
  await requireOwner(server, actor);
  if (updates.method.installType !== "supervised" || !updates.method.oneClick) {
    throw new OneClickNotAvailableError();
  }
  if (updates.isBusy) {
    throw new UpdateAlreadyRunningError();
  }
  const installed = (await listInstalledVersions(updates.home, currentLink(updates.home))).find(
    (candidate) => candidate.version === request.version,
  );
  if (!installed || !existsSync(versionFolder(updates.home, request.version))) {
    throw new VersionNotInstalledError(request.version);
  }
  if (installed.current || request.version === updates.currentVersion) {
    throw new AlreadyRunningVersionError(request.version);
  }
  // Going back across database changes is only safe with the database put back as it was.
  if (
    installed.databaseDiffers &&
    !(request.restoreBackup && installed.databaseCopyBeforeLeaving)
  ) {
    throw new RollbackNeedsDatabaseCopyError(
      updates.currentVersion,
      request.version,
      installed.databaseCopyBeforeLeaving !== null,
    );
  }
  const databaseCopy = request.restoreBackup ? installed.databaseCopyBeforeLeaving : null;
  // Without a copy (a Postgres server), the backup's rows go back into the same tables.
  const backupFile =
    request.restoreBackup && !databaseCopy && installed.backupBeforeLeaving
      ? join(server.dataTools.backupsFolder, installed.backupBeforeLeaving)
      : null;
  const restoring = databaseCopy !== null || backupFile !== null;

  await recordSecurityEvent(server.database, {
    kind: "lintel-rolled-back",
    actor: { id: actor.id, email: actor.email },
    origin,
    details: {
      from: updates.currentVersion,
      to: request.version,
      restoredBackup: restoring,
    },
  });
  const progress = progressReporter(updates, request.version, "rollback");
  if (backupFile) progress.backup(installed.backupBeforeLeaving);
  const first = progress("maintenance", `Going back to Lintel ${request.version}.`);
  updates.askSupervisor({
    kind: "rollback",
    version: request.version,
    backupFile,
    restoreBackupFirst: restoring,
    databaseCopy,
  });
  return first;
}

async function requireOwner(server: FastifyInstance, actor: Actor): Promise<void> {
  if (!(await isOwner(server.database, actor.id))) {
    throw new OwnersOnlyError();
  }
}

async function askDockerUpdater(updates: UpdatesRuntime, version: string): Promise<void> {
  const updater = updates.dockerUpdater;
  if (!updater) {
    throw new OneClickNotAvailableError();
  }
  let response: Response;
  try {
    response = await updates.fetch(`${updater.url.replace(/\/+$/, "")}/update`, {
      method: "POST",
      headers: { Authorization: `Bearer ${updater.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ version }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new UpdaterUnreachableError(error instanceof Error ? error.message : "no answer");
  }
  if (!response.ok) {
    throw new UpdaterUnreachableError(`it answered ${response.status}`);
  }
}

interface ProgressReporter {
  (
    step: UpdateStepId,
    message: string,
    fraction?: number | null,
    finished?: boolean,
  ): UpdateProgress;
  backup(filename: string | null): void;
}

function progressReporter(
  updates: UpdatesRuntime,
  version: string,
  kind: UpdateProgress["kind"],
): ProgressReporter {
  const startedAt = new Date().toISOString();
  let backupFilename: string | null = null;
  const report = ((step, message, fraction = null, finished = false) => {
    const progress: UpdateProgress = {
      version,
      fromVersion: updates.currentVersion,
      kind,
      step,
      message,
      fraction,
      startedAt,
      finishedAt: finished ? new Date().toISOString() : null,
      backupFilename,
      databaseCopy: null,
    };
    updates.report(progress);
    return progress;
  }) as ProgressReporter;
  report.backup = (filename) => {
    backupFilename = filename;
  };
  return report;
}
