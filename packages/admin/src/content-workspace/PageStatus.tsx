import type { Entry } from "../content/content.types.js";
import { formatDateTime } from "../content/relativeTime.js";
import { StatusMark } from "../content-tree/StatusMark.js";
import type { NodeState } from "../content-tree/treeActions.js";
import { t } from "../i18n/strings.js";

export type PageState = "draft" | "live" | "liveWithChanges" | "scheduled";

/** Where the page stands on the website, as the top bar says it. */
export function pageStateOf(entry: Entry, hasUnsavedChanges: boolean): PageState {
  if (entry.status === "scheduled") return "scheduled";
  if (entry.status !== "published") return "draft";
  return entry.hasUnpublishedChanges || hasUnsavedChanges ? "liveWithChanges" : "live";
}

const marks: Record<PageState, NodeState> = {
  draft: "draft",
  live: "published",
  liveWithChanges: "changed",
  scheduled: "scheduled",
};

interface PageStatusProps {
  /** Undefined for a new page. */
  entry: Entry | undefined;
  state: PageState;
  /** Said instead of the usual words, for something more particular. */
  note?: string;
}

/**
 * "Live on your site", "Draft, not on your site yet"…: the page's state in words with its
 * mark, under the page's name in both views, so nobody has to read it from a button.
 */
export function PageStatus({ entry, state, note }: PageStatusProps) {
  const words =
    state === "scheduled" && entry?.scheduledFor
      ? t("workspace.status.scheduled", { when: formatDateTime(entry.scheduledFor) })
      : t(`workspace.status.${state === "scheduled" ? "draft" : state}`);
  return (
    <span className="flex min-w-0 items-center gap-1 text-caption text-label-secondary">
      <StatusMark state={marks[state]} isDecorative />
      <span className="truncate" title={note ?? words}>
        {note ?? words}
      </span>
    </span>
  );
}
