import { t, type StringKey } from "../i18n/strings.js";
import type { Revision, RevisionKind } from "./content.types.js";
import { formatDateTime } from "./relativeTime.js";

const kindLabels: Record<Exclude<RevisionKind, "restored">, StringKey> = {
  edited: "revisions.edited",
  published: "revisions.published",
  unpublished: "revisions.unpublished",
  scheduled: "revisions.scheduled",
};

/**
 * What a History line says. The newest edit is what is in the editor right now, so it reads
 * "Current draft"; a restore says which version it brought back.
 */
export function revisionLabel(revision: Revision, isLatest: boolean): string {
  if (revision.kind === "restored") {
    return revision.restoredFromAt
      ? t("revisions.restoredFrom", { date: formatDateTime(revision.restoredFromAt) })
      : t("revisions.restore");
  }
  if (revision.kind === "edited" && isLatest) {
    return t("revisions.currentDraft");
  }
  return t(kindLabels[revision.kind]);
}

export interface RevisionDay {
  key: string;
  /** "Today", "Yesterday" or a date such as "Mon, 2 Nov". */
  label: string;
  revisions: Revision[];
}

/** Revisions in the order given, split by the local day they last changed on. */
export function groupRevisionsByDay(revisions: readonly Revision[], now: number): RevisionDay[] {
  const days: RevisionDay[] = [];
  for (const revision of revisions) {
    const key = localDayKey(new Date(revision.updatedAt));
    const day = days.at(-1);
    if (day && day.key === key) {
      day.revisions.push(revision);
    } else {
      days.push({ key, label: dayLabel(key, now), revisions: [revision] });
    }
  }
  return days;
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function dayLabel(key: string, now: number): string {
  const today = new Date(now);
  if (key === localDayKey(today)) return t("revisions.today");
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (key === localDayKey(yesterday)) return t("revisions.yesterday");
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }),
  }).format(date);
}
