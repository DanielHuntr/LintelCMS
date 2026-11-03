import { ChevronRight } from "lucide-react";
import { createContext, use, useId, useState, type ReactNode } from "react";
import { classNames } from "../design/classNames.js";

/** True inside the editor's side panel, where sections fold to keep it calm. */
export const FoldingPanelContext = createContext(false);

interface PanelSectionProps {
  title: string;
  /** Something small beside the title, such as the status badge. */
  accessory?: ReactNode;
  /** What's set inside, in a word or two, shown on the right while it is folded. */
  value?: string;
  /** Opens by itself: something inside needs attention. */
  needsAttention?: boolean;
  /** For what must always be in view, such as Status. */
  isAlwaysOpen?: boolean;
  children: ReactNode;
}

const openSectionsKey = "lintel.editor.openPanelSections";

function readOpenSections(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(openSectionsKey) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((title): title is string => typeof title === "string")
      : [];
  } catch {
    return [];
  }
}

function rememberOpenSection(title: string, isOpen: boolean): void {
  const others = readOpenSections().filter((candidate) => candidate !== title);
  try {
    window.localStorage.setItem(
      openSectionsKey,
      JSON.stringify(isOpen ? [...others, title] : others),
    );
  } catch {
    // Private windows can refuse storage; the panel then just folds again next time.
  }
}

/**
 * One group of the editor's side panel, like a section of the inspector in Keynote. There it
 * folds to one row with its setting on the right; the groups someone opens stay open for them.
 * The contents stay mounted while folded, so what they save or load carries on.
 */
export function PanelSection({
  title,
  accessory,
  value,
  needsAttention = false,
  isAlwaysOpen = false,
  children,
}: PanelSectionProps) {
  const titleId = useId();
  const contentId = useId();
  const folds = use(FoldingPanelContext) && !isAlwaysOpen;
  const [isChosenOpen, setIsChosenOpen] = useState(
    () => folds && readOpenSections().includes(title),
  );

  if (!folds) {
    return (
      <section
        aria-labelledby={titleId}
        className="flex flex-col gap-3 px-4 py-4 [&+&]:hairline-top"
      >
        <header className="flex min-h-5 items-center justify-between gap-2">
          <h2 id={titleId} className="text-footnote font-semibold text-label-secondary">
            {title}
          </h2>
          {accessory}
        </header>
        {children}
      </section>
    );
  }

  const isOpen = isChosenOpen || needsAttention;
  return (
    <section aria-labelledby={titleId} className="flex flex-col [&+&]:hairline-top">
      <h2 className="m-0">
        <button
          id={titleId}
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => {
            setIsChosenOpen(!isOpen);
            rememberOpenSection(title, !isOpen);
          }}
          className="flex min-h-11 w-full items-center gap-2 px-4 text-start hover:bg-fill/50 focus-visible:focus-ring"
        >
          <span className="shrink-0 text-footnote font-semibold text-label">{title}</span>
          <span className="ms-auto flex min-w-0 items-center gap-2">
            {accessory}
            {value && !isOpen && (
              <span className="truncate text-footnote text-label-secondary">{value}</span>
            )}
            <ChevronRight
              aria-hidden="true"
              strokeWidth={2}
              className={classNames(
                "size-4 shrink-0 text-label-tertiary motion-safe:transition-transform motion-safe:duration-150",
                isOpen && "rotate-90",
              )}
            />
          </span>
        </button>
      </h2>
      <div
        id={contentId}
        hidden={!isOpen}
        className="flex-col gap-3 px-4 pb-4 [&:not([hidden])]:flex"
      >
        {children}
      </div>
    </section>
  );
}
