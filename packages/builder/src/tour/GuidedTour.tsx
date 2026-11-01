import { X } from "lucide-react";
import { type KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import type { SkillLevel } from "../skill-level/skill-levels.js";
import { classNames } from "../ui/classNames.js";
import { keepFocusInside, useReturnFocus } from "../ui/focus-trap.js";
import { type Box, boxAround, placeCard, tourStepsFor } from "./tour-steps.js";

interface GuidedTourProps {
  /** Some steps say more, or less, for each skill level. */
  skillLevel: SkillLevel;
  /** Called when the tour ends, finished or skipped. */
  onClose: () => void;
}

const cardWidth = 340;
/** Room around the spotlit part, so its edges aren't hidden by the ring. */
const spotlightPadding = 6;

function measure(targets: readonly string[]): Box | null {
  const boxes = targets.flatMap((target) => {
    const element = document.querySelector(target);
    if (!element) return [];
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return [];
    return [{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }];
  });
  return boxAround(boxes);
}

/**
 * A short walk around the builder. Each step dims the screen except the part it's about and
 * explains it in a small card beside it. The card is a modal dialog: focus moves to each
 * step's title and stays inside the card, Escape or Skip ends the tour, and focus goes back
 * where it was. Movement only happens for people who haven't asked for less.
 */
export function GuidedTour({ skillLevel, onClose }: GuidedTourProps) {
  const text = useBuilderText();
  const steps = useMemo(() => tourStepsFor(skillLevel), [skillLevel]);
  const [index, setIndex] = useState(0);
  const [target, setTarget] = useState<Box | null>(null);
  const [cardHeight, setCardHeight] = useState(220);
  const card = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const step = steps[index] ?? steps[0]!;
  const isLast = index === steps.length - 1;
  useReturnFocus(true);

  useLayoutEffect(() => {
    const update = () => setTarget(measure(step.targets));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [step.targets]);

  useLayoutEffect(() => {
    const height = card.current?.offsetHeight;
    if (height) setCardHeight(height);
  }, [index]);

  useEffect(() => title.current?.focus(), [index]);

  const screen = { width: window.innerWidth, height: window.innerHeight };
  const spotlight = target && {
    top: target.top - spotlightPadding,
    left: target.left - spotlightPadding,
    width: target.width + 2 * spotlightPadding,
    height: target.height + 2 * spotlightPadding,
  };
  const place = placeCard(spotlight, screen, { width: cardWidth, height: cardHeight });

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    keepFocusInside(card.current, event);
  }

  const moveClassName = "motion-safe:transition-all motion-safe:duration-200";
  return (
    <>
      {/* Catches clicks around the card, so the tour is finished or skipped, not lost. */}
      <div aria-hidden="true" className="fixed inset-0 z-40" />
      <div
        aria-hidden="true"
        data-testid="tour-spotlight"
        className={classNames(
          "pointer-events-none fixed z-40",
          spotlight ? "rounded-card ring-2 ring-accent" : "inset-0 bg-scrim",
          moveClassName,
        )}
        style={
          spotlight ? { ...spotlight, boxShadow: "0 0 0 100vmax var(--color-scrim)" } : undefined
        }
      />
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lintel-tour-title"
        aria-describedby="lintel-tour-text"
        onKeyDown={handleKeyDown}
        className={classNames(
          "fixed z-50 flex flex-col gap-3 rounded-panel bg-surface-raised p-4 text-label shadow-float hairline-ring",
          moveClassName,
        )}
        style={{ top: place.top, left: place.left, width: cardWidth }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-caption font-semibold text-accent">
            {text("pageBuilder.tour.progress", { step: index + 1, count: steps.length })}
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
          <ProgressDots count={steps.length} current={index} />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              className="h-8 rounded-control px-2 text-footnote font-medium text-label-secondary hover:bg-fill focus-visible:focus-ring"
            >
              {text("pageBuilder.tour.skip")}
            </button>
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

/** A dot per step, the current one filled. "Step 2 of 6" already says this to screen readers. */
function ProgressDots({ count, current }: { count: number; current: number }) {
  return (
    <ol aria-hidden="true" className="flex items-center gap-1.5">
      {Array.from({ length: count }, (_, dot) => (
        <li
          key={dot}
          className={classNames(
            "size-1.5 rounded-full motion-safe:transition-colors",
            dot === current ? "bg-accent" : "bg-fill-strong",
          )}
        />
      ))}
    </ol>
  );
}
