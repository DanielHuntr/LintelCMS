import { X } from "lucide-react";
import { type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { placeCard, tourSteps } from "./tour-steps.js";

interface GuidedTourProps {
  /** Called when the tour ends, finished or skipped. */
  onClose: () => void;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const cardSize = { width: 340, height: 220 };

function findTarget(target: string | null): Box | null {
  if (!target) return null;
  const element = document.querySelector(target);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return rect.width === 0 && rect.height === 0
    ? null
    : { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

/**
 * A card that walks someone through the builder, pointing at each part as it goes. It is a
 * dialog that doesn't block the page: focus moves to each step's title, Tab reaches Back,
 * Next and Skip, Escape skips, and the highlighted part stays usable.
 */
export function GuidedTour({ onClose }: GuidedTourProps) {
  const text = useBuilderText();
  const [index, setIndex] = useState(0);
  const [target, setTarget] = useState<Box | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const step = tourSteps[index] ?? tourSteps[0]!;
  const isLast = index === tourSteps.length - 1;

  useLayoutEffect(() => {
    const measure = () => setTarget(findTarget(step.target));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [step.target]);

  useEffect(() => title.current?.focus(), [index]);

  const screen = { width: window.innerWidth, height: window.innerHeight };
  const place = placeCard(target, screen, cardSize);

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  }

  return (
    <>
      {target && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-40 rounded-card ring-4 ring-accent motion-safe:transition-all motion-safe:duration-200"
          style={{
            top: target.top - 4,
            left: target.left - 4,
            width: target.width + 8,
            height: target.height + 8,
          }}
        />
      )}
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="lintel-tour-title"
        aria-describedby="lintel-tour-text"
        onKeyDown={handleKeyDown}
        className="fixed z-50 flex flex-col gap-3 rounded-panel bg-surface-raised p-4 text-label shadow-float hairline-ring"
        style={{ top: place.top, left: place.left, width: cardSize.width }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-caption font-semibold text-accent">
            {text("pageBuilder.tour.progress", { step: index + 1, count: tourSteps.length })}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label={text("pageBuilder.tour.skip")}
            className="-mt-1 -me-1 flex size-7 items-center justify-center rounded-control text-label-secondary hover:bg-fill focus-visible:focus-ring"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <h2 id="lintel-tour-title" ref={title} tabIndex={-1} className="text-headline outline-none">
          {text(step.title)}
        </h2>
        <p id="lintel-tour-text" className="text-footnote text-label-secondary">
          {text(step.text)}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-control px-2 text-footnote font-medium text-label-secondary hover:bg-fill focus-visible:focus-ring"
          >
            {text("pageBuilder.tour.skip")}
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex(index - 1)}
                className="h-8 rounded-control px-3 text-footnote font-medium text-accent hover:bg-fill focus-visible:focus-ring"
              >
                {text("pageBuilder.tour.back")}
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? onClose() : setIndex(index + 1))}
              className="h-8 rounded-control bg-accent-fill px-3 text-footnote font-semibold text-on-accent focus-visible:focus-ring"
            >
              {isLast ? text("pageBuilder.tour.finish") : text("pageBuilder.tour.next")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
