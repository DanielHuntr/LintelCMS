import type { Entry } from "../content/content.types.js";
import { formatDateTime } from "../content/relativeTime.js";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";

export type PageState = "draft" | "live" | "liveWithChanges" | "scheduled";

/** Where the page stands on the website, as the bar along the bottom says it. */
export function pageStateOf(entry: Entry, hasUnsavedChanges: boolean): PageState {
  if (entry.status === "scheduled") return "scheduled";
  if (entry.status !== "published") return "draft";
  return entry.hasUnpublishedChanges || hasUnsavedChanges ? "liveWithChanges" : "live";
}

const dots: Record<PageState, string> = {
  draft: "bg-label-tertiary",
  live: "bg-success",
  liveWithChanges: "bg-warning",
  scheduled: "bg-accent",
};

/**
 * "Live on your site", "Draft, not on your site yet"…: the page's state in words, with a
 * coloured dot, so nobody has to read it from which buttons are greyed out.
 */
export function PageStatus({ entry, state }: { entry: Entry; state: PageState }) {
  const words =
    state === "scheduled" && entry.scheduledFor
      ? t("workspace.status.scheduled", { when: formatDateTime(entry.scheduledFor) })
      : t(`workspace.status.${state === "scheduled" ? "draft" : state}`);
  return (
    <span className="flex min-w-0 items-center gap-2 text-footnote font-medium text-label">
      <span
        aria-hidden="true"
        className={classNames("size-2 shrink-0 rounded-full", dots[state])}
      />
      <span className="truncate">{words}</span>
    </span>
  );
}
