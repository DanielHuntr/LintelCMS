import type { FocalPoint } from "@lintel/core/media-crop";
import { type KeyboardEvent, type PointerEvent, useId, useRef } from "react";
import { t } from "../i18n/strings.js";
import { useFittedSize } from "./useFittedSize.js";

interface FocalPointPickerProps {
  imageUrl: string;
  /** The image's width divided by its height, to size the picture before it loads. */
  aspectRatio: number;
  value: FocalPoint;
  /** Every movement, for the live crop previews. */
  onChange: (point: FocalPoint) => void;
  /** When a movement ends (pointer released or key pressed): the moment to save. */
  onCommit: (point: FocalPoint) => void;
}

const SMALL_STEP = 0.01;
const LARGE_STEP = 0.1;

/**
 * Marks where the subject of a photo is. Click or drag on the picture; or focus it and use
 * the arrow keys (Shift moves ten times further). The point is announced as percentages.
 */
export function FocalPointPicker({
  imageUrl,
  aspectRatio,
  value,
  onChange,
  onCommit,
}: FocalPointPickerProps) {
  const helpId = useId();
  const isDragging = useRef(false);
  const [frame, fittedSize] = useFittedSize(aspectRatio);
  const valueText = t("media.detail.focalPoint.value", {
    x: Math.round(value.x * 100),
    y: Math.round(value.y * 100),
  });

  function pointFromPointer(event: PointerEvent<HTMLDivElement>): FocalPoint {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: roundToStep(clamp((event.clientX - bounds.left) / bounds.width)),
      y: roundToStep(clamp((event.clientY - bounds.top) / bounds.height)),
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    isDragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    onChange(pointFromPointer(event));
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (isDragging.current) onChange(pointFromPointer(event));
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return;
    isDragging.current = false;
    onCommit(pointFromPointer(event));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? LARGE_STEP : SMALL_STEP;
    const moves: Partial<Record<string, [number, number]>> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const next = {
      x: roundToStep(clamp(value.x + move[0])),
      y: roundToStep(clamp(value.y + move[1])),
    };
    onChange(next);
    onCommit(next);
  }

  return (
    <div ref={frame} className="flex size-full items-center justify-center">
      <div
        tabIndex={0}
        role="application"
        aria-roledescription={t("media.detail.focalPoint.label")}
        aria-label={t("media.detail.focalPoint.label")}
        aria-describedby={helpId}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => (isDragging.current = false)}
        onKeyDown={handleKeyDown}
        className="relative cursor-crosshair touch-none overflow-hidden rounded-control shadow-float outline-none select-none focus-visible:focus-ring"
        style={fittedSize}
      >
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          className="pointer-events-none block size-full object-contain"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute size-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-white bg-white/15 shadow-[0_0_0_1px_rgb(0_0_0/0.25),0_2px_10px_rgb(0_0_0/0.35)] transition-[left,top] duration-75"
          style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%` }}
        >
          <span className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
        </span>
      </div>
      <p id={helpId} className="sr-only">
        {t("media.detail.focalPoint.help")} {valueText}
      </p>
      <span aria-live="polite" className="sr-only">
        {valueText}
      </span>
    </div>
  );
}

function clamp(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/** Whole percentages: finer than anyone can see, and tidy in the database. */
function roundToStep(value: number): number {
  return Math.round(value * 100) / 100;
}
