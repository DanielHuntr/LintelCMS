import { CircleCheck, CircleDashed, Clock, Pencil, type LucideIcon } from "lucide-react";
import { formatDateTime } from "../content/relativeTime.js";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import type { NodeState } from "./treeActions.js";

/** Each state has its own shape, so colour is never the only clue. */
const appearance: Record<NodeState, { icon: LucideIcon; colour: string }> = {
  published: { icon: CircleCheck, colour: "text-success" },
  changed: { icon: Pencil, colour: "text-warning" },
  draft: { icon: CircleDashed, colour: "text-label-secondary" },
  scheduled: { icon: Clock, colour: "text-accent" },
};

/** An entry's state in words, with the date for one that is scheduled. */
export function statusLabel(state: NodeState, scheduledFor?: string | null): string {
  return state === "scheduled" && scheduledFor
    ? t("tree.status.scheduledFor", { when: formatDateTime(scheduledFor) })
    : t(`tree.status.${state}`);
}

interface StatusMarkProps {
  state: NodeState;
  scheduledFor?: string | null;
  /** True where the words are beside it, so saying them again would only repeat them. */
  isDecorative?: boolean;
}

/** The small mark for an entry's state, named for screen readers and as a tooltip. */
export function StatusMark({ state, scheduledFor, isDecorative = false }: StatusMarkProps) {
  const { icon: Icon, colour } = appearance[state];
  const label = statusLabel(state, scheduledFor);
  return (
    <span
      {...(isDecorative ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
      title={isDecorative ? undefined : label}
      className={classNames("flex size-4 shrink-0 items-center justify-center", colour)}
    >
      <Icon aria-hidden="true" strokeWidth={2} className="size-3.5" />
    </span>
  );
}
