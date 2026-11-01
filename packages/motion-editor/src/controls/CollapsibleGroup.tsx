import { ChevronRight } from "lucide-react";
import { type ReactNode, useId } from "react";
import { classNames } from "./classNames.js";

interface CollapsibleGroupProps {
  title: string;
  /** What's chosen inside, shown beside the title while closed. */
  summary?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * A disclosure: a heading that is a button (`aria-expanded`) and the controls it shows or
 * hides. Closed content isn't drawn, so it can't be tabbed into.
 */
export function CollapsibleGroup({
  title,
  summary,
  isOpen,
  onToggle,
  children,
}: CollapsibleGroupProps) {
  const buttonId = useId();
  const contentId = useId();
  return (
    <section aria-labelledby={buttonId} className="hairline-top">
      <h3 className="m-0">
        <button
          id={buttonId}
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={onToggle}
          className="-mx-1.5 flex h-10 w-[calc(100%+0.75rem)] min-w-0 items-center gap-1.5 rounded-control px-1.5 text-start transition-colors duration-150 hover:bg-fill/60 focus-visible:focus-ring"
        >
          <ChevronRight
            aria-hidden="true"
            className={classNames(
              "size-3.5 shrink-0 text-label-tertiary motion-safe:transition-transform motion-safe:duration-150",
              isOpen && "rotate-90",
            )}
          />
          <span className="shrink-0 text-footnote font-semibold text-label">{title}</span>
          {!isOpen && summary && (
            <span className="ms-auto min-w-0 truncate ps-2 text-caption text-label-secondary">
              {summary}
            </span>
          )}
        </button>
      </h3>
      <div id={contentId} hidden={!isOpen} className="pt-1 pb-4">
        {isOpen && children}
      </div>
    </section>
  );
}

/** Which groups are open. Hosts can pass their own to remember it; otherwise it lasts a visit. */
export interface OpenGroups {
  isOpen: (groupId: string) => boolean;
  toggle: (groupId: string) => void;
}
