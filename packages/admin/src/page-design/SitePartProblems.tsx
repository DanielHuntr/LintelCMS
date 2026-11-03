import { t } from "../i18n/strings.js";

/** A save of a part every page shares (the site's styles, navigation or footer) that failed. */
export interface SitePartProblem {
  message: string;
  /** Sends the change again; left out when there is nothing to send. */
  retry?: () => void;
  /** What that button says, when it isn't simply trying again. */
  retryLabel?: string;
}

/**
 * Says when the site's styles, navigation or footer weren't saved, at the top of the
 * builder (the page's own save problems show at the foot), with Try again where it helps.
 */
export function SitePartProblems({
  problems,
}: {
  problems: readonly (SitePartProblem | null | undefined)[];
}) {
  const shown = problems.filter((problem): problem is SitePartProblem => Boolean(problem));
  if (shown.length === 0) return null;
  return (
    <div className="fixed top-14 left-1/2 z-40 flex w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2">
      {shown.map((problem) => (
        <p
          key={problem.message}
          role="alert"
          className="flex items-center gap-3 rounded-card bg-surface-raised px-4 py-3 text-footnote text-danger shadow-float"
        >
          <span className="flex-1">{problem.message}</span>
          {problem.retry && (
            <button
              type="button"
              onClick={problem.retry}
              className="shrink-0 rounded-control px-2 py-1 font-semibold text-accent hover:bg-fill focus-visible:focus-ring"
            >
              {problem.retryLabel ?? t("pageDesign.sitePartsRetry")}
            </button>
          )}
        </p>
      ))}
    </div>
  );
}
