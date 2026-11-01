import { Check, CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { Button } from "../design/Button.js";
import { t, type StringKey } from "../i18n/strings.js";
import type { UpdateProgress, UpdateStep } from "./updates.api.js";

type Phase = "backup" | "download" | "verify" | "restart" | "done";

const phases: readonly Phase[] = ["backup", "download", "verify", "restart", "done"];

const phaseOfStep: Record<UpdateStep, Phase> = {
  checking: "backup",
  "backing-up": "backup",
  downloading: "download",
  verifying: "verify",
  unpacking: "verify",
  maintenance: "restart",
  migrating: "restart",
  switching: "restart",
  restarting: "restart",
  "health-check": "restart",
  "rolling-back": "restart",
  done: "done",
  failed: "done",
};

/**
 * An update or roll back as it happens: the steps, the one under way and its sentence
 * (announced to screen readers), and how it ended. Shown on Settings → Updates.
 */
export function UpdateProgressPanel({
  progress,
  restarting,
}: {
  progress: UpdateProgress;
  restarting: boolean;
}) {
  const failed = progress.step === "failed";
  const done = progress.step === "done";
  const rollback = progress.kind === "rollback";
  // A roll back has no download; it goes straight to restarting.
  const shown = rollback
    ? phases.filter((phase) => phase === "restart" || phase === "done")
    : phases;
  const currentIndex = shown.indexOf(phaseOfStep[progress.step]);

  const title = failed
    ? t("updates.progressFailedTitle")
    : done
      ? t(rollback ? "updates.rollbackDoneTitle" : "updates.progressDoneTitle", {
          version: progress.version,
        })
      : t(rollback ? "updates.rollbackProgressTitle" : "updates.progressTitle", {
          version: progress.version,
        });

  return (
    <section
      aria-labelledby="update-progress-title"
      className={`flex flex-col gap-4 rounded-card p-5 ${failed ? "bg-danger/10" : done ? "bg-success/10" : "bg-surface"}`}
    >
      <header className="flex items-center gap-3">
        {failed ? (
          <CircleAlert aria-hidden="true" strokeWidth={1.75} className="size-7 text-danger" />
        ) : done ? (
          <CircleCheck aria-hidden="true" strokeWidth={1.75} className="size-7 text-success" />
        ) : (
          <LoaderCircle
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-7 text-accent motion-safe:animate-spin"
          />
        )}
        <h2 id="update-progress-title" className="text-headline text-label">
          {title}
        </h2>
      </header>

      {!done && !failed && (
        <ol className="flex flex-col gap-2">
          {shown
            .filter((phase) => phase !== "done")
            .map((phase, index) => {
              const state =
                index < currentIndex ? "done" : index === currentIndex ? "current" : "waiting";
              return (
                <li key={phase} className="flex items-center gap-2.5 text-body">
                  <span
                    aria-hidden="true"
                    className={`flex size-5 items-center justify-center rounded-full ${
                      state === "done"
                        ? "bg-success text-on-accent"
                        : state === "current"
                          ? "bg-accent/15 text-accent"
                          : "bg-fill text-label-tertiary"
                    }`}
                  >
                    {state === "done" ? <Check strokeWidth={3} className="size-3" /> : index + 1}
                  </span>
                  <span className={state === "waiting" ? "text-label-secondary" : "text-label"}>
                    {t(`updates.phase.${phase}` as StringKey)}
                  </span>
                  <span className="sr-only">{t(`updates.phaseState.${state}` as StringKey)}</span>
                </li>
              );
            })}
        </ol>
      )}

      {progress.step === "downloading" && progress.fraction !== null && (
        <div className="flex flex-col gap-1">
          <progress
            className="h-1.5 w-full overflow-hidden rounded-full accent-[var(--color-accent)]"
            value={progress.fraction}
            max={1}
            aria-label={t("updates.phase.download")}
          />
          <span className="text-footnote text-label-secondary">
            {t("updates.downloaded", { percent: Math.round(progress.fraction * 100) })}
          </span>
        </div>
      )}

      <p role="status" aria-live="polite" className="text-body text-label">
        {progress.message}
      </p>
      {restarting && !done && !failed && (
        <p className="text-footnote text-label-secondary">{t("updates.restartingNote")}</p>
      )}
      {failed && (
        <p className="text-footnote text-label-secondary">{t("updates.progressFailedHelp")}</p>
      )}
      {progress.backupFilename && (
        <p className="text-footnote text-label-secondary">
          {t("updates.backupMade", { file: progress.backupFilename })}
        </p>
      )}
      {done && !rollback && (
        <div>
          <Button variant="tinted" onClick={() => window.location.reload()}>
            {t("updates.reload")}
          </Button>
        </div>
      )}
    </section>
  );
}
