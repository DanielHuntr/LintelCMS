import { CircleCheck, ShieldAlert } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { formatDateTime } from "../content/relativeTime.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { TextField } from "../design/TextField.js";
import { t, type StringKey } from "../i18n/strings.js";
import type { RestoreSummary } from "./dataTools.api.js";
import { useRestoreBackup, useRestorePreview } from "./dataTools.queries.js";

/** The tables people recognise, in the order they think of them; the rest aren't listed. */
const shownTables = [
  "entries",
  "assets",
  "users",
  "terms",
  "navigations",
  "collections",
  "blueprints",
  "redirects",
  "revisions",
];

/**
 * /settings/backups/:id/restore: the warning screen before a restore. It says plainly that
 * everything is replaced, shows what the site has now against what it will have, and asks
 * for a tick and the word RESTORE, so it can't happen by a stray click.
 */
export function RestorePage({ backupId }: { backupId: string }) {
  const preview = useRestorePreview(backupId);
  const restore = useRestoreBackup(backupId);

  if (restore.isSuccess) {
    return <RestoreDone summary={restore.data} />;
  }

  return (
    <>
      <BackLink to="/settings/backups">{t("backups.title")}</BackLink>
      <LargeTitle title={t("restore.title")} />
      {preview.isError && (
        <LoadError error={preview.error} onRetry={() => void preview.refetch()} />
      )}
      {preview.isPending && (
        <LoadingRegion label={t("restore.loading")}>
          <Skeleton className="h-64 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {preview.data && (
        <div className="flex max-w-2xl flex-col gap-6">
          <RestoreWarning summary={preview.data} />
          <ComparisonTable summary={preview.data} />
          <ConfirmRestoreForm
            isRestoring={restore.isPending}
            error={restore.isError ? describeError(restore.error) : null}
            onConfirm={() => restore.mutate()}
          />
        </div>
      )}
    </>
  );
}

function RestoreWarning({ summary }: { summary: RestoreSummary }) {
  return (
    <section
      aria-labelledby="restore-warning-title"
      className="flex gap-4 rounded-card bg-danger/10 p-5 text-label"
    >
      <ShieldAlert aria-hidden="true" strokeWidth={1.75} className="size-8 shrink-0 text-danger" />
      <div className="flex flex-col gap-2">
        <h2 id="restore-warning-title" className="text-headline">
          {t("restore.warningTitle")}
        </h2>
        <p className="text-body">
          {t("restore.warningText", { when: formatDateTime(summary.createdAt) })}
        </p>
        <p className="text-footnote text-label-secondary">{t("restore.safetyNote")}</p>
        <p className="text-footnote text-label-secondary">{t("restore.signOutNote")}</p>
      </div>
    </section>
  );
}

function ComparisonTable({ summary }: { summary: RestoreSummary }) {
  const rows = shownTables.flatMap((name) => {
    const table = summary.tables.find((candidate) => candidate.table === name);
    return table && (table.current > 0 || table.inBackup > 0) ? [table] : [];
  });
  return (
    <Card title={t("restore.compareTitle")}>
      <table className="w-full text-left text-body text-label">
        <thead className="text-footnote text-label-secondary">
          <tr>
            <th scope="col" className="pb-2 font-medium">
              {t("restore.compareWhat")}
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              {t("restore.compareNow")}
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              {t("restore.compareBackup")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.table} className="hairline-top">
              <th scope="row" className="py-2 font-normal">
                {t(`restore.table.${row.table}` as StringKey)}
              </th>
              <td className="py-2 text-right tabular-nums">{row.current.toLocaleString("en")}</td>
              <td className="py-2 text-right font-semibold tabular-nums">
                {row.inBackup.toLocaleString("en")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function ConfirmRestoreForm({
  isRestoring,
  error,
  onConfirm,
}: {
  isRestoring: boolean;
  error: string | null;
  onConfirm: () => void;
}) {
  const [understood, setUnderstood] = useState(false);
  const [typed, setTyped] = useState("");
  const checkboxId = useId();
  const ready = understood && typed.trim() === "RESTORE" && !isRestoring;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (ready) onConfirm();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-card bg-surface p-5">
      <div className="flex items-start gap-3">
        <input
          id={checkboxId}
          type="checkbox"
          checked={understood}
          onChange={(event) => setUnderstood(event.target.checked)}
          className="mt-1 size-4 accent-[var(--color-danger)]"
        />
        <label htmlFor={checkboxId} className="text-body text-label">
          {t("restore.understand")}
        </label>
      </div>
      <TextField
        label={t("restore.typeToConfirm")}
        value={typed}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => setTyped(event.target.value)}
      />
      {isRestoring && (
        <p role="status" className="text-footnote text-label-secondary">
          {t("restore.restoring")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-footnote text-danger">
          {error}
        </p>
      )}
      <div>
        <Button type="submit" variant="destructive" disabled={!ready}>
          {t("restore.confirm")}
        </Button>
      </div>
    </form>
  );
}

function RestoreDone({ summary }: { summary: RestoreSummary }) {
  return (
    <div className="flex max-w-xl flex-col items-start gap-4 pt-8">
      <CircleCheck aria-hidden="true" strokeWidth={1.75} className="size-10 text-success" />
      <h1 className="text-large-title text-label">{t("restore.doneTitle")}</h1>
      <p className="text-body text-label-secondary">
        {t("restore.doneText", { when: formatDateTime(summary.createdAt) })}
      </p>
      {/* The restore ended every session, this one included. */}
      <LinkButton to="/sign-in" reloadDocument>
        {t("restore.signIn")}
      </LinkButton>
    </div>
  );
}
