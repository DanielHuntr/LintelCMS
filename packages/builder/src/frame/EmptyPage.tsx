import type { StarterPage, StarterSite } from "@lintel/builder-model";
import { LayoutTemplate, PanelsTopLeft, Shapes } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { TemplatePagesDialog } from "./TemplatePagesDialog.js";

interface EmptyPageProps {
  /** Whole pages to start from; with none, there's no "Start from a template" link. */
  starterSites: readonly StarterSite[];
  onAddSection: () => void;
  onAddElements: () => void;
  onChooseStarterPage: (page: StarterPage, name: string) => void;
  /** Focus goes to the heading when the page opens empty, unless something else wants it. */
  takesFocus: boolean;
}

/**
 * What an empty page shows on the canvas: one calm line and two ways to begin, both opening
 * Insert, where every section and element already lives. Pages from the template library are
 * a small link away, for sites that have them.
 */
export function EmptyPage({
  starterSites,
  onAddSection,
  onAddElements,
  onChooseStarterPage,
  takesFocus,
}: EmptyPageProps) {
  const text = useBuilderText();
  const heading = useRef<HTMLHeadingElement>(null);
  const templateLink = useRef<HTMLButtonElement>(null);
  const [isChoosingTemplate, setChoosingTemplate] = useState(false);
  const hasTemplatePages = starterSites.some((site) => site.pages.length > 0);

  // Only when the empty page first appears, not again when the tour closes.
  const focusOnOpen = useRef(takesFocus);
  useEffect(() => {
    if (focusOnOpen.current) heading.current?.focus();
  }, []);

  const buttonClassName =
    "flex h-9 items-center justify-center gap-2 rounded-control px-4 text-footnote font-semibold focus-visible:focus-ring";

  return (
    <div
      data-tour="canvas"
      className="flex flex-1 items-center justify-center overflow-auto bg-background p-8"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-panel bg-surface px-8 py-10 text-center shadow-float">
        <div className="flex flex-col gap-1.5">
          <h2 ref={heading} tabIndex={-1} className="text-title text-label outline-none">
            {text("pageBuilder.start.title")}
          </h2>
          <p className="text-body text-label-secondary">{text("pageBuilder.start.description")}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onAddSection}
            className={`${buttonClassName} bg-accent-fill text-on-accent`}
          >
            <PanelsTopLeft aria-hidden="true" className="size-4" />
            {text("pageBuilder.start.addSection")}
          </button>
          <button
            type="button"
            onClick={onAddElements}
            className={`${buttonClassName} bg-fill text-accent hover:bg-fill-strong`}
          >
            <Shapes aria-hidden="true" className="size-4" />
            {text("pageBuilder.start.addElements")}
          </button>
        </div>
        {hasTemplatePages && (
          <button
            ref={templateLink}
            type="button"
            aria-haspopup="dialog"
            onClick={() => setChoosingTemplate(true)}
            className="flex items-center gap-1.5 rounded-control px-2 py-1 text-footnote font-medium text-accent hover:underline focus-visible:focus-ring"
          >
            <LayoutTemplate aria-hidden="true" className="size-3.5" />
            {text("pageBuilder.start.fromTemplate")}
          </button>
        )}
      </div>
      {isChoosingTemplate && (
        <TemplatePagesDialog
          starterSites={starterSites}
          returnFocusTo={templateLink}
          onChoose={(page, name) => {
            setChoosingTemplate(false);
            onChooseStarterPage(page, name);
          }}
          onClose={() => setChoosingTemplate(false)}
        />
      )}
    </div>
  );
}
