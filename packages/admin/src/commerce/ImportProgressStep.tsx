import { useEffect, useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { t } from "../i18n/strings.js";
import type { ShopifyImport } from "./shopifyImport.api.js";
import { useRunBatch } from "./shopifyImport.queries.js";

/**
 * Step 3: the import running. The admin asks for one short batch after another while this
 * screen is open; closing it pauses the import, and "Carry on" picks it up where it stopped.
 */
export function ImportProgressStep({ job }: { job: ShopifyImport }) {
  const run = useRunBatch(job.id);
  // An import found paused (its window was closed) waits for "Carry on"; a fresh one runs.
  const [running, setRunning] = useState(!job.paused);
  const { mutate, isPending, isError } = run;

  useEffect(() => {
    if (running && !isPending && !isError && job.status === "importing") {
      mutate();
    }
  }, [running, job.done, job.status, isPending, isError, mutate]);

  const percent = job.total === 0 ? 100 : Math.round((job.done / job.total) * 100);
  const stopped = isError || !running;

  return (
    <Card title={t("shop.import.progressHeader")} className="max-w-2xl">
      <div className="flex flex-col gap-4">
        <p className="text-body text-label" role="status" aria-live="polite">
          {t(`shop.import.stage.${job.stage}`, { done: job.done, total: job.total })}
        </p>
        <div
          role="progressbar"
          aria-label={t("shop.import.progressHeader")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-2 w-full overflow-hidden rounded-full bg-fill"
        >
          <div className="h-full rounded-full bg-accent-fill" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-footnote text-label-secondary">{t("shop.import.progressHint")}</p>
        {run.error && (
          <p role="alert" className="text-footnote text-danger">
            {describeError(run.error)}
          </p>
        )}
        {stopped && (
          <div>
            <Button
              onClick={() => {
                run.reset();
                setRunning(true);
              }}
            >
              {t("shop.import.carryOn")}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
