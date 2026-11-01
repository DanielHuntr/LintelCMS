import type { Easing } from "@lintel/motion";
import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { TextInput } from "../controls/Field.js";
import { useTranslate } from "../strings/translate.js";
import { curvePath, pointFor, valueAt, type CurveBox } from "./curvePath.js";

type Bezier = Extract<Easing, { type: "cubicBezier" }>;
type Handle = "first" | "second";

interface BezierCurveEditorProps {
  value: Bezier;
  onChange: (value: Bezier, mergeKey?: string) => void;
  onCommit: () => void;
}

const box: CurveBox = { size: 200, overshoot: 0.25 };
const round = (value: number) => Math.round(value * 100) / 100;
const clampTime = (value: number) => Math.min(Math.max(round(value), 0), 1);
const clampProgress = (value: number) => Math.min(Math.max(round(value), -2), 3);

const arrowSteps: Partial<Record<string, [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
};

/**
 * A cubic Bézier with its two handles. Drag a handle, or focus it and use the arrow keys
 * (hold Shift for bigger steps). The number fields give exact values.
 */
export function BezierCurveEditor({ value, onChange, onCommit }: BezierCurveEditorProps) {
  const t = useTranslate();
  const svg = useRef<SVGSVGElement>(null);
  const handles: Record<Handle, { time: number; progress: number }> = {
    first: { time: value.x1, progress: value.y1 },
    second: { time: value.x2, progress: value.y2 },
  };

  function setHandle(handle: Handle, time: number, progress: number) {
    const next =
      handle === "first"
        ? { ...value, x1: clampTime(time), y1: clampProgress(progress) }
        : { ...value, x2: clampTime(time), y2: clampProgress(progress) };
    onChange(next, `bezier-${handle}`);
  }

  function drag(event: PointerEvent<SVGCircleElement>, handle: Handle) {
    const bounds = svg.current?.getBoundingClientRect();
    if (!bounds || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const scale = box.size / bounds.width;
    const point = valueAt(
      box,
      (event.clientX - bounds.left) * scale,
      (event.clientY - bounds.top) * scale,
    );
    setHandle(handle, point.time, point.progress);
  }

  function nudge(event: KeyboardEvent<SVGCircleElement>, handle: Handle) {
    const step = arrowSteps[event.key];
    if (!step) return;
    event.preventDefault();
    const size = event.shiftKey ? 0.1 : 0.01;
    setHandle(
      handle,
      handles[handle].time + step[0] * size,
      handles[handle].progress + step[1] * size,
    );
  }

  const start = pointFor(box, 0, 0);
  const end = pointFor(box, 1, 1);
  const anchors: Record<Handle, { x: number; y: number }> = { first: start, second: end };

  return (
    <div className="flex flex-wrap items-start gap-4">
      <svg
        ref={svg}
        viewBox={`-10 -10 ${box.size + 20} ${box.size + 20}`}
        className="w-48 shrink-0 touch-none overflow-visible"
      >
        <rect
          x="0"
          y={end.y}
          width={box.size}
          height={start.y - end.y}
          fill="var(--color-fill)"
          rx="4"
        />
        <path
          d={curvePath(value, box)}
          fill="none"
          stroke="var(--color-accent-fill)"
          strokeWidth="2.5"
        />
        {(["first", "second"] as const).map((handle) => {
          const point = pointFor(box, handles[handle].time, handles[handle].progress);
          return (
            <g key={handle}>
              <line
                x1={anchors[handle].x}
                y1={anchors[handle].y}
                x2={point.x}
                y2={point.y}
                stroke="var(--color-label-secondary)"
                strokeWidth="1"
              />
              <circle
                cx={point.x}
                cy={point.y}
                r="8"
                tabIndex={0}
                role="slider"
                aria-label={t(
                  handle === "first"
                    ? "motionEditor.easing.firstHandle"
                    : "motionEditor.easing.secondHandle",
                )}
                aria-valuetext={t("motionEditor.easing.handleValue", {
                  time: handles[handle].time,
                  progress: handles[handle].progress,
                })}
                aria-valuenow={handles[handle].progress}
                className="cursor-grab fill-surface stroke-accent focus-visible:focus-ring"
                strokeWidth="2.5"
                onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
                onPointerMove={(event) => drag(event, handle)}
                onPointerUp={onCommit}
                onKeyDown={(event) => nudge(event, handle)}
                onKeyUp={onCommit}
              />
            </g>
          );
        })}
      </svg>
      <div className="grid w-40 grid-cols-2 gap-2">
        {(["x1", "y1", "x2", "y2"] as const).map((key) => (
          <TextInput
            key={key}
            label={key}
            type="number"
            step={0.01}
            min={key.startsWith("x") ? 0 : -2}
            max={key.startsWith("x") ? 1 : 3}
            value={value[key]}
            onChange={(event) => {
              const number = Number(event.target.value);
              if (!Number.isFinite(number)) return;
              onChange(
                {
                  ...value,
                  [key]: key.startsWith("x") ? clampTime(number) : clampProgress(number),
                },
                `bezier-${key}`,
              );
            }}
            onBlur={onCommit}
          />
        ))}
      </div>
    </div>
  );
}
