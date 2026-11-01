import { Badge } from "../design/Badge.js";
import type { Tone } from "../design/tones.js";
import { t } from "../i18n/strings.js";
import type { RunStatus } from "./workflows.types.js";

const tones: Record<RunStatus, Tone> = {
  queued: "neutral",
  running: "accent",
  waiting: "warning",
  succeeded: "success",
  failed: "danger",
  cancelled: "neutral",
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return <Badge tone={tones[status]}>{t(`history.status.${status}`)}</Badge>;
}
