import { useId, type KeyboardEvent, type Ref } from "react";
import { classNames } from "../controls/classNames.js";
import type { MotionDemo } from "./quickPicks.js";

const shape = "motion-demo-shape block rounded-[4px] bg-label";

/** The drawing for one demo: a small square for most, a few bars or dots for the rest. */
function DemoDrawing({ demo }: { demo: MotionDemo }) {
  switch (demo) {
    case "words":
    case "scramble":
    case "wave":
      return (
        <span className="flex items-end gap-0.5">
          <span className={classNames(shape, "h-1.5 w-2.5")} />
          <span className={classNames(shape, "h-1.5 w-3.5")} />
          <span className={classNames(shape, "h-1.5 w-2")} />
        </span>
      );
    case "dots":
      return (
        <span className="flex items-center gap-1">
          <span className={classNames(shape, "size-1.5 rounded-full")} />
          <span className={classNames(shape, "size-1.5 rounded-full")} />
          <span className={classNames(shape, "size-1.5 rounded-full")} />
        </span>
      );
    case "underline":
      return (
        <span className="flex flex-col items-start gap-1">
          <span className="block h-1.5 w-8 rounded-[2px] bg-label" />
          <span className="motion-demo-extra block h-0.5 w-8 origin-left rounded-full bg-label" />
        </span>
      );
    case "roll":
      return (
        <span className="block h-1.5 w-8 overflow-hidden">
          <span className="motion-demo-shape flex flex-col gap-1">
            <span className="block h-1.5 w-8 rounded-[2px] bg-label" />
            <span className="block h-1.5 w-8 rounded-[2px] bg-label" />
          </span>
        </span>
      );
    case "bolder":
      return <span className={classNames(shape, "h-1 w-8 rounded-[2px]")} />;
    case "fill":
      return (
        <span className="block h-1.5 w-9 overflow-hidden rounded-full bg-fill-strong">
          <span className="motion-demo-extra block h-full w-full origin-left rounded-full bg-label" />
        </span>
      );
    case "magnet":
      return (
        <span className="relative block">
          <span className={classNames(shape, "size-4")} />
          <span className="motion-demo-extra absolute top-1.5 left-1.5 block size-1.5 rounded-full bg-label" />
        </span>
      );
    case "parallax":
      return (
        <span className="relative block">
          <span className={classNames(shape, "relative z-10 size-4")} />
          <span className="motion-demo-extra absolute -top-1 -left-2.5 block size-3 rounded-[3px] bg-label opacity-30" />
        </span>
      );
    case "spin":
      return (
        <span className="motion-demo-shape block size-4 rounded-full border-2 border-label border-t-transparent" />
      );
    case "tilt":
    case "swing":
      return <span className={classNames(shape, "h-4 w-5", demo === "swing" && "origin-top")} />;
    default:
      return <span className={classNames(shape, "size-4")} />;
  }
}

interface MotionTileProps {
  demo: MotionDemo;
  name: string;
  /** What it does, in a sentence: the tooltip, and what screen readers hear after the name. */
  description: string;
  checked: boolean;
  disabled?: boolean;
  /** Whether arrow keys and Tab land here: the checked tile, or the first when none is. */
  focusable: boolean;
  onChoose: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  buttonRef?: Ref<HTMLButtonElement>;
}

/** One small choice: the movement itself, looping quietly, with a one- or two-word name. */
export function MotionTile({
  demo,
  name,
  description,
  checked,
  disabled,
  focusable,
  onChoose,
  onKeyDown,
  buttonRef,
}: MotionTileProps) {
  const descriptionId = useId();
  return (
    <button
      ref={buttonRef}
      type="button"
      role="radio"
      aria-checked={checked}
      aria-describedby={descriptionId}
      disabled={disabled}
      tabIndex={focusable ? 0 : -1}
      title={description}
      onClick={onChoose}
      onKeyDown={onKeyDown}
      className={classNames(
        "flex min-w-0 flex-col items-center gap-1 rounded-control bg-background px-1 pt-1 pb-1.5",
        "transition-colors duration-150 ease-standard hover:bg-fill focus-visible:focus-ring",
        "aria-checked:bg-surface aria-checked:ring-[1.5px] aria-checked:ring-accent-fill",
        "disabled:opacity-50",
      )}
    >
      <span
        aria-hidden="true"
        data-motion-demo={demo}
        className="flex h-10 w-full items-center justify-center overflow-hidden rounded-[6px] bg-fill/60"
      >
        <DemoDrawing demo={demo} />
      </span>
      <span className="w-full text-center text-caption leading-tight font-medium text-label">
        {name}
      </span>
      <span id={descriptionId} hidden>
        {description}
      </span>
    </button>
  );
}
