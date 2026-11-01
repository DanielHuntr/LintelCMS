import { CircleCheck, TriangleAlert } from "lucide-react";
import { useId, useState, type ChangeEvent, type FormEvent } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { controlClasses } from "../design/controlStyles.js";
import { Dialog } from "../design/Dialog.js";
import { t } from "../i18n/strings.js";
import type { RedirectImportResult } from "./seo.api.js";
import { useImportRedirects } from "./seo.queries.js";

/**
 * Bringing redirects in from a spreadsheet or an old site: choose a CSV file or paste the
 * rows. Afterwards it says how many went in and which lines couldn't be used, and why.
 */
export function ImportRedirectsDialog({ onClose }: { onClose: () => void }) {
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<RedirectImportResult | null>(null);
  const importRedirects = useImportRedirects();
  const fileId = useId();
  const textId = useId();
  const hintId = useId();

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) setCsv(await file.text());
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    importRedirects.mutate(csv, { onSuccess: setResult });
  }

  if (result) {
    return (
      <Dialog
        open
        onClose={onClose}
        title={t("redirects.importDoneTitle")}
        footer={
          <Button onClick={onClose} data-autofocus>
            {t("common.done")}
          </Button>
        }
      >
        <div className="flex flex-col gap-3 text-body text-label">
          <p className="flex items-center gap-2">
            <CircleCheck aria-hidden="true" strokeWidth={2} className="size-5 text-success" />
            {t("redirects.importSummary", { added: result.added, updated: result.updated })}
          </p>
          {result.problems.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="flex items-center gap-2 text-footnote font-medium">
                <TriangleAlert aria-hidden="true" strokeWidth={2} className="size-4 text-warning" />
                {t("redirects.importProblems")}
              </p>
              <ul className="flex flex-col gap-1 text-footnote text-label-secondary">
                {result.problems.map((problem) => (
                  <li key={problem.line}>
                    {t("redirects.importProblem", { line: problem.line, message: problem.message })}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("redirects.importTitle")}
      description={t("redirects.importDescription")}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="import-redirects-form"
            disabled={csv.trim() === "" || importRedirects.isPending}
          >
            {importRedirects.isPending ? t("redirects.importing") : t("redirects.import")}
          </Button>
        </>
      }
    >
      <form id="import-redirects-form" onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={fileId} className="text-footnote font-medium text-label">
            {t("redirects.importFile")}
          </label>
          <input
            id={fileId}
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(event) => void readFile(event)}
            className="text-footnote text-label file:mr-3 file:rounded-control file:border-0 file:bg-accent/12 file:px-3 file:py-1.5 file:font-medium file:text-accent"
            data-autofocus
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={textId} className="text-footnote font-medium text-label">
            {t("redirects.importPaste")}
          </label>
          <textarea
            id={textId}
            value={csv}
            rows={6}
            aria-describedby={hintId}
            placeholder={"from,to,status\n/old-page,/new-page,301"}
            onChange={(event) => setCsv(event.target.value)}
            className={`resize-y py-2 font-mono text-footnote ${controlClasses()}`}
          />
          <p id={hintId} className="text-footnote text-label-secondary">
            {t("redirects.importHint")}
          </p>
        </div>
        {importRedirects.isError && (
          <p role="alert" className="text-footnote text-danger">
            {describeError(importRedirects.error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}
