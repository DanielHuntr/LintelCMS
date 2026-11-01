import { useId, useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { t } from "../i18n/strings.js";
import type { InstalledVersion } from "./updates.api.js";

interface UpdateConfirmDialogProps {
  open: boolean;
  version: string;
  currentVersion: string;
  isWorking: boolean;
  error: unknown;
  onConfirm: () => void;
  onCancel: () => void;
}

/** "Update to Lintel 1.2.0?": what will happen, and a tick before the button works. */
export function UpdateConfirmDialog({
  open,
  version,
  currentVersion,
  isWorking,
  error,
  onConfirm,
  onCancel,
}: UpdateConfirmDialogProps) {
  const [understood, setUnderstood] = useState(false);
  const checkboxId = useId();
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={t("updates.confirmTitle", { version })}
      footer={
        <>
          <Button variant="plain" onClick={onCancel} disabled={isWorking}>
            {t("updates.cancel")}
          </Button>
          <Button onClick={onConfirm} disabled={!understood || isWorking}>
            {t("updates.confirm")}
          </Button>
        </>
      }
    >
      <ul className="flex list-disc flex-col gap-2 pl-5 text-body text-label">
        <li>{t("updates.confirmBackup")}</li>
        <li>{t("updates.confirmDowntime")}</li>
        <li>{t("updates.confirmRollback", { version: currentVersion })}</li>
      </ul>
      <div className="mt-4 flex items-start gap-3">
        <input
          id={checkboxId}
          type="checkbox"
          data-autofocus
          checked={understood}
          onChange={(event) => setUnderstood(event.target.checked)}
          className="mt-1 size-4 accent-[var(--color-accent)]"
        />
        <label htmlFor={checkboxId} className="text-body text-label">
          {t("updates.confirmUnderstand")}
        </label>
      </div>
      {error !== null && error !== undefined && (
        <p role="alert" className="mt-3 text-footnote text-danger">
          {describeError(error)}
        </p>
      )}
    </Dialog>
  );
}

interface RollbackDialogProps {
  target: InstalledVersion | null;
  isWorking: boolean;
  error: unknown;
  onConfirm: (restoreBackup: boolean) => void;
  onCancel: () => void;
}

/** "Go back to Lintel 1.0.0?", with the choice to put the earlier backup back too. */
export function RollbackDialog({
  target,
  isWorking,
  error,
  onConfirm,
  onCancel,
}: RollbackDialogProps) {
  const [restoreBackup, setRestoreBackup] = useState(false);
  const checkboxId = useId();
  const helpId = useId();
  if (!target) return null;
  return (
    <Dialog
      open
      onClose={onCancel}
      title={t("updates.rollbackTitle", { version: target.version })}
      footer={
        <>
          <Button variant="plain" onClick={onCancel} disabled={isWorking}>
            {t("updates.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(restoreBackup)}
            disabled={isWorking}
          >
            {t("updates.rollbackConfirm")}
          </Button>
        </>
      }
    >
      <p className="text-body text-label">
        {t("updates.rollbackText", { version: target.version })}
      </p>
      {target.backupBeforeLeaving ? (
        <div className="mt-4 flex items-start gap-3">
          <input
            id={checkboxId}
            type="checkbox"
            data-autofocus
            aria-describedby={helpId}
            checked={restoreBackup}
            onChange={(event) => setRestoreBackup(event.target.checked)}
            className="mt-1 size-4 accent-[var(--color-danger)]"
          />
          <div className="flex flex-col gap-1">
            <label htmlFor={checkboxId} className="text-body text-label">
              {t("updates.rollbackRestore", { version: target.version })}
            </label>
            <p id={helpId} className="text-footnote text-label-secondary">
              {t("updates.rollbackRestoreHelp")}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-footnote text-label-secondary">{t("updates.rollbackNoBackup")}</p>
      )}
      {error !== null && error !== undefined && (
        <p role="alert" className="mt-3 text-footnote text-danger">
          {describeError(error)}
        </p>
      )}
    </Dialog>
  );
}
