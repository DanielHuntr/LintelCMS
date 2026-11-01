import { Link } from "@tanstack/react-router";
import { Archive, Download, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatDateTime } from "../content/relativeTime.js";
import { Badge } from "../design/Badge.js";
import { Button, buttonClasses } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { t, type StringKey } from "../i18n/strings.js";
import { formatFileSize } from "../media/formatting.js";
import { type Backup, backupDownloadUrl } from "./dataTools.api.js";
import { useDeleteBackup } from "./dataTools.queries.js";

/** The backups in the backups folder, newest first, with what can be done with each. */
export function BackupList({ backups, canManage }: { backups: Backup[]; canManage: boolean }) {
  const [deleting, setDeleting] = useState<Backup | null>(null);
  const deleteBackup = useDeleteBackup();

  return (
    <>
      <GroupedList header={t("backups.listHeader")} footer={t("backups.listFooter")}>
        {backups.map((backup) => (
          <GroupedListRow
            key={backup.id}
            icon={Archive}
            iconTone={backup.status === "failed" ? "danger" : backup.trigger === "scheduled" ? "neutral" : "accent"}
            label={formatDateTime(backup.createdAt)}
            description={describeBackup(backup)}
            wrapsText
            accessory={
              <BackupActions
                backup={backup}
                canManage={canManage}
                onDelete={() => setDeleting(backup)}
              />
            }
          />
        ))}
      </GroupedList>
      <ConfirmDialog
        open={deleting !== null}
        title={t("backups.deleteTitle")}
        message={t("backups.deleteMessage", { when: deleting ? formatDateTime(deleting.createdAt) : "" })}
        confirmLabel={t("backups.delete")}
        cancelLabel={t("common.cancel")}
        isDestructive
        isWorking={deleteBackup.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting && deleteBackup.mutate(deleting.id, { onSettled: () => setDeleting(null) })
        }
      />
    </>
  );
}

function describeBackup(backup: Backup): string {
  const who =
    backup.trigger === "manual"
      ? backup.createdByName
        ? t("backups.trigger.manual", { name: backup.createdByName })
        : t("backups.trigger.manualUnknown")
      : t(`backups.trigger.${backup.trigger}` as StringKey);
  if (backup.status === "failed") {
    return `${who} · ${backup.failureReason ?? ""}`;
  }
  return backup.size === null ? who : `${who} · ${formatFileSize(backup.size)}`;
}

function BackupActions({
  backup,
  canManage,
  onDelete,
}: {
  backup: Backup;
  canManage: boolean;
  onDelete: () => void;
}) {
  const when = formatDateTime(backup.createdAt);
  if (backup.status === "running") {
    return <Badge tone="accent">{t("backups.status.running")}</Badge>;
  }
  if (!canManage) {
    return backup.status === "failed" ? <Badge tone="danger">{t("backups.status.failed")}</Badge> : null;
  }
  return (
    <div className="flex items-center gap-1">
      {backup.status === "failed" ? (
        <Badge tone="danger">{t("backups.status.failed")}</Badge>
      ) : (
        <>
          <a
            href={backupDownloadUrl(backup.id)}
            className={buttonClasses("plain", "small")}
            aria-label={t("backups.downloadLabel", { when })}
          >
            <Download aria-hidden="true" className="size-4" />
            {t("backups.download")}
          </a>
          <Link
            to="/settings/backups/$backupId/restore"
            params={{ backupId: backup.id }}
            className={buttonClasses("plain", "small")}
            aria-label={t("backups.restoreLabel", { when })}
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            {t("backups.restore")}
          </Link>
        </>
      )}
      <Button
        variant="plain"
        size="small"
        onClick={onDelete}
        aria-label={t("backups.deleteLabel", { when })}
        icon={<Trash2 aria-hidden="true" />}
      >
        <span className="sr-only">{t("backups.delete")}</span>
      </Button>
    </div>
  );
}
