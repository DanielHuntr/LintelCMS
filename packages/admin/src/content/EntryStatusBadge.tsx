import { Badge } from "../design/Badge.js";
import type { Tone } from "../design/tones.js";
import { t, type StringKey } from "../i18n/strings.js";
import type { EntryStatus } from "./content.types.js";

const statusAppearance: Record<EntryStatus, { tone: Tone; label: StringKey }> = {
  draft: { tone: "neutral", label: "entry.status.draft" },
  published: { tone: "success", label: "entry.status.published" },
  scheduled: { tone: "accent", label: "entry.status.scheduled" },
};

/** "Draft", "Published" or "Scheduled", in the same colours everywhere. */
export function EntryStatusBadge({ status }: { status: EntryStatus }) {
  const { tone, label } = statusAppearance[status];
  return <Badge tone={tone}>{t(label)}</Badge>;
}
