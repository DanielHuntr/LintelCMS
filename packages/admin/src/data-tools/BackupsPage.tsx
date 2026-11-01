import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Archive, DatabaseBackup, Upload } from "lucide-react";
import { type ChangeEvent, useId, useState } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Button, buttonClasses } from "../design/Button.js";
import { EmptyState } from "../design/EmptyState.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { BackupList } from "./BackupList.js";
import { BackupScheduleCard } from "./BackupScheduleCard.js";
import { type Backup, uploadFiles } from "./dataTools.api.js";
import { dataToolsKeys, useBackups, useCreateBackup } from "./dataTools.queries.js";

/** /settings/backups: making, downloading and restoring backups, and the schedule. */
export function BackupsPage() {
  const backups = useBackups();
  const createBackup = useCreateBackup();
  const canManage = useCan("backups:manage");

  const actions = canManage && (
    <>
      <UploadBackupButton />
      <Button
        icon={<DatabaseBackup aria-hidden="true" />}
        onClick={() => createBackup.mutate()}
        disabled={createBackup.isPending}
      >
        {createBackup.isPending ? t("backups.backingUp") : t("backups.backUpNow")}
      </Button>
    </>
  );

  return (
    <>
      <BackLink to="/settings">{t("nav.settings")}</BackLink>
      <LargeTitle title={t("backups.title")} subtitle={t("backups.subtitle")} actions={actions} />
      {createBackup.isError && (
        <p role="alert" className="mb-4 max-w-2xl text-footnote text-danger">
          {describeError(createBackup.error)}
        </p>
      )}
      {backups.isError && (
        <LoadError error={backups.error} onRetry={() => void backups.refetch()} />
      )}
      {backups.isPending && (
        <LoadingRegion label={t("backups.loading")}>
          <Skeleton className="h-40 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {backups.data && (
        <div className="flex max-w-2xl flex-col gap-8">
          {backups.data.backups.length === 0 ? (
            <div className="rounded-card bg-surface">
              <EmptyState
                icon={Archive}
                title={t("backups.emptyTitle")}
                description={t("backups.emptyDescription")}
              />
            </div>
          ) : (
            <BackupList backups={backups.data.backups} canManage={canManage} />
          )}
          <BackupScheduleCard schedule={backups.data.schedule} canChange={canManage} />
        </div>
      )}
    </>
  );
}

/** Adds a backup file from elsewhere to the list, then goes straight to restoring it. */
function UploadBackupButton() {
  const inputId = useId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      const backup = await uploadFiles<Backup>("/backups/upload", { file }, setProgress);
      await queryClient.invalidateQueries({ queryKey: dataToolsKeys.backups() });
      void navigate({ to: "/settings/backups/$backupId/restore", params: { backupId: backup.id } });
    } catch (uploadError) {
      setError(describeError(uploadError));
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="flex flex-col items-end">
      <input
        id={inputId}
        type="file"
        accept=".zip,application/zip"
        className="peer sr-only"
        onChange={(event) => void upload(event)}
        disabled={progress !== null}
        aria-label={t("backups.uploadLabel")}
      />
      <label
        htmlFor={inputId}
        className={`${buttonClasses("tinted")} cursor-pointer peer-focus-visible:focus-ring`}
      >
        <Upload aria-hidden="true" className="-ml-0.5 size-[1.1em]" />
        {progress === null
          ? t("backups.upload")
          : t("backups.uploading", { percent: Math.round(progress * 100) })}
      </label>
      {error && (
        <p role="alert" className="mt-1 max-w-xs text-right text-footnote text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
