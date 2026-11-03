import { Link } from "@tanstack/react-router";
import { t } from "../i18n/strings.js";
import { StatusMark } from "./StatusMark.js";
import type { NodeState } from "./treeActions.js";

const states: readonly NodeState[] = ["published", "changed", "draft", "scheduled"];

/**
 * What the tree's marks mean, opened from the button beside "Content". It opens in the pane
 * rather than floating, so it can't be cut off by the tree's scrolling or a phone's edge.
 */
export function StatusKey({ id }: { id: string }) {
  return (
    <section
      id={id}
      aria-label={t("tree.key.title")}
      className="mx-1 mt-1 mb-2 flex flex-col gap-2.5 rounded-card bg-surface px-3 py-3 hairline-ring"
    >
      <ul className="flex flex-col gap-2.5">
        {states.map((state) => (
          <li key={state} className="flex gap-2">
            <span className="mt-px">
              <StatusMark state={state} isDecorative />
            </span>
            <p className="min-w-0 text-footnote text-label-secondary">
              <span className="block font-medium text-label">{t(`tree.status.${state}`)}</span>
              {t(`tree.key.${state}`)}
            </p>
          </li>
        ))}
      </ul>
      <Link
        to="/help"
        search={{ topic: "using/content-tree" }}
        className="self-start text-footnote font-medium text-label underline decoration-1 underline-offset-2 hover:decoration-2 focus-visible:focus-ring"
      >
        {t("tree.key.learnMore")}
      </Link>
    </section>
  );
}
