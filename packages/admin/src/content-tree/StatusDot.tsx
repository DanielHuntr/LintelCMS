import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import type { NodeState } from "./treeActions.js";

const appearance: Record<NodeState, string> = {
  published: "bg-success",
  // Live, with newer saved changes: a ring of the live colour around the draft one.
  changed: "bg-warning ring-2 ring-success/40",
  draft: "border border-label-tertiary bg-transparent",
  scheduled: "bg-accent",
};

/**
 * A small dot for an entry's state, with its name as a tooltip. Colour is never the only
 * clue: a draft is hollow, and rows also say the state to screen readers.
 */
export function StatusDot({ state }: { state: NodeState }) {
  const label = t(`tree.status.${state}`);
  return (
    <span
      aria-hidden="true"
      title={label}
      className={classNames("size-2 shrink-0 rounded-full", appearance[state])}
    />
  );
}
