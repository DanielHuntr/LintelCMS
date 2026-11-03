import { ChevronRight } from "lucide-react";
import { createContext, type ReactNode, useContext, useId } from "react";
import type { OpenSections } from "../preferences/open-sections.js";
import { classNames } from "./classNames.js";

/**
 * A panel's open and closed sections. A panel that provides one turns its `PanelSection`s
 * (those given a `sectionId`) into collapsible sections; without it they are plain groups.
 */
export const OpenSectionsContext = createContext<OpenSections | null>(null);

export function useOpenSections(): OpenSections | null {
  return useContext(OpenSectionsContext);
}

interface CollapsibleSectionProps {
  title: string;
  /** What's set inside, shown beside the title while closed: "Row · gap M". */
  summary?: string;
  /** The summary names one of the site's styles: a small dot says it's linked. */
  linked?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  /** Called when focus moves into the section, so the panel can remember it was used. */
  onUse?: () => void;
  children: ReactNode;
  isContentDisabled?: boolean;
  /** For sections inside sections, such as the categories in Insert. */
  variant?: "panel" | "group";
}

/**
 * A disclosure: a heading that is a button (`aria-expanded`), and what it shows or hides. The
 * content isn't drawn while closed, so a closed section costs nothing and can't be tabbed into.
 */
export function CollapsibleSection({
  title,
  summary,
  linked = false,
  isOpen,
  onToggle,
  onUse,
  children,
  isContentDisabled = false,
  variant = "panel",
}: CollapsibleSectionProps) {
  const buttonId = useId();
  const contentId = useId();
  const isPanel = variant === "panel";
  return (
    <section
      aria-labelledby={buttonId}
      onFocus={onUse}
      className={classNames(isPanel && "hairline-bottom")}
    >
      <h3 className="m-0">
        <button
          id={buttonId}
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={onToggle}
          className={classNames(
            "flex w-full min-w-0 items-center gap-1.5 text-start transition-colors duration-150 hover:bg-fill/60 focus-visible:focus-ring",
            isPanel ? "h-11 px-4" : "h-8 rounded-control px-1.5",
          )}
        >
          <ChevronRight
            aria-hidden="true"
            className={classNames(
              "size-3.5 shrink-0 text-label-tertiary motion-safe:transition-transform motion-safe:duration-150",
              isOpen && "rotate-90",
            )}
          />
          <span
            className={classNames(
              "shrink-0 font-semibold text-label",
              isPanel
                ? "text-footnote"
                : "text-caption tracking-wide text-label-secondary uppercase",
            )}
          >
            {title}
          </span>
          {!isOpen && summary && (
            <span className="ms-auto flex min-w-0 items-center gap-1.5 ps-2 text-caption text-label-secondary">
              {linked && (
                <span
                  aria-hidden="true"
                  className="size-1.5 shrink-0 rounded-full bg-accent-fill"
                />
              )}
              <span className="min-w-0 truncate">{summary}</span>
            </span>
          )}
        </button>
      </h3>
      <div
        id={contentId}
        hidden={!isOpen}
        className={classNames(isPanel ? "flex flex-col gap-3 px-4 pt-1 pb-4" : "pt-1 pb-2")}
      >
        {isOpen &&
          (isContentDisabled ? (
            <fieldset disabled className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
              {children}
            </fieldset>
          ) : (
            children
          ))}
      </div>
    </section>
  );
}
