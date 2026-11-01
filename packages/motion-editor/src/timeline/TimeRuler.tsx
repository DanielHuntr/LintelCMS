import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslate } from "../strings/translate.js";
import { clamp, formatSeconds, tickStep, ticks } from "./timelineMath.js";

interface TimeRulerProps {
  duration: number;
  pixelsPerMillisecond: number;
  playhead: number;
  onSeek: (milliseconds: number) => void;
}

/**
 * The ruler above the tracks. Click or drag on it to scrub; the playhead is a slider, so
 * the arrow keys step through time (Shift for bigger steps, Home and End for the ends).
 */
export function TimeRuler({ duration, pixelsPerMillisecond, playhead, onSeek }: TimeRulerProps) {
  const t = useTranslate();
  const ruler = useRef<HTMLDivElement>(null);
  const step = tickStep(pixelsPerMillisecond);

  function seekToPointer(event: PointerEvent) {
    const box = ruler.current?.getBoundingClientRect();
    if (!box) return;
    onSeek(clamp(Math.round((event.clientX - box.left) / pixelsPerMillisecond), 0, duration));
  }

  function handleKeyDown(event: KeyboardEvent) {
    const stepSize = event.shiftKey ? 100 : 10;
    const targets: Partial<Record<string, number>> = {
      ArrowLeft: playhead - stepSize,
      ArrowDown: playhead - stepSize,
      ArrowRight: playhead + stepSize,
      ArrowUp: playhead + stepSize,
      Home: 0,
      End: duration,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    onSeek(clamp(target, 0, duration));
  }

  return (
    <div
      ref={ruler}
      className="relative h-7 cursor-ew-resize touch-none select-none hairline-bottom"
      style={{ width: duration * pixelsPerMillisecond }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        seekToPointer(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) seekToPointer(event);
      }}
    >
      {ticks(duration, step).map((time) => (
        <span
          key={time}
          className="absolute top-0 flex h-full flex-col justify-end"
          style={{ left: time * pixelsPerMillisecond }}
        >
          <span className="-translate-x-1/2 pb-1 text-caption whitespace-nowrap text-label-tertiary tabular-nums">
            {formatSeconds(time)}
          </span>
          <span className="h-1.5 w-px bg-separator" />
        </span>
      ))}
      <div
        role="slider"
        tabIndex={0}
        aria-label={t("motionEditor.timeline.playhead")}
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={playhead}
        aria-valuetext={formatSeconds(playhead)}
        onKeyDown={handleKeyDown}
        className="absolute top-0 z-10 h-full w-3 -translate-x-1/2 cursor-ew-resize rounded-sm bg-accent-fill focus-visible:focus-ring"
        style={{ left: playhead * pixelsPerMillisecond }}
      />
    </div>
  );
}
