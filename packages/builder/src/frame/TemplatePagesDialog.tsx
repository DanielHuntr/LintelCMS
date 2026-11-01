import type { StarterPage, StarterSite } from "@lintel/builder-model";
import { X } from "lucide-react";
import { type KeyboardEvent, type RefObject, useEffect, useRef } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { keepFocusInside, useReturnFocus } from "../ui/focus-trap.js";

interface TemplatePagesDialogProps {
  starterSites: readonly StarterSite[];
  /** Where focus goes when the dialog closes. */
  returnFocusTo: RefObject<HTMLElement | null>;
  onChoose: (page: StarterPage, name: string) => void;
  onClose: () => void;
}

/**
 * "Start from a template": every page of every template as a plain list, one row each, so an
 * empty page can begin as a whole page. Modal: Escape or Close shuts it and focus goes back.
 */
export function TemplatePagesDialog({
  starterSites,
  returnFocusTo,
  onChoose,
  onClose,
}: TemplatePagesDialogProps) {
  const text = useBuilderText();
  const dialog = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useReturnFocus(true, returnFocusTo);
  useEffect(() => title.current?.focus(), []);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    keepFocusInside(dialog.current, event);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-scrim p-6">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lintel-template-pages-title"
        aria-describedby="lintel-template-pages-description"
        onKeyDown={handleKeyDown}
        className="flex max-h-full w-full max-w-lg flex-col rounded-panel bg-surface-raised text-start text-label shadow-float hairline-ring"
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-3 hairline-bottom">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2
              id="lintel-template-pages-title"
              ref={title}
              tabIndex={-1}
              className="text-headline outline-none"
            >
              {text("pageBuilder.start.fromTemplate")}
            </h2>
            <p
              id="lintel-template-pages-description"
              className="text-footnote text-label-secondary"
            >
              {text("pageBuilder.start.templatesDescription")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={text("pageBuilder.start.closeTemplates")}
            className="-me-1 flex size-7 shrink-0 items-center justify-center rounded-control text-label-secondary hover:bg-fill focus-visible:focus-ring"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <ul className="flex min-h-0 flex-col overflow-auto p-2">
          {starterSites.flatMap((site) =>
            site.pages.map((page) => {
              const name = text("pageBuilder.start.templatePage", {
                site: site.name,
                page: page.title,
              });
              return (
                <li key={`${site.id}/${page.slug}`}>
                  <button
                    type="button"
                    onClick={() => onChoose(page, name)}
                    className="flex w-full flex-col rounded-control px-3 py-2 text-start hover:bg-fill focus-visible:focus-ring"
                  >
                    <span className="text-footnote font-semibold text-label">{name}</span>
                    <span className="text-caption text-label-secondary">{page.summary}</span>
                  </button>
                </li>
              );
            }),
          )}
        </ul>
      </div>
    </div>
  );
}
