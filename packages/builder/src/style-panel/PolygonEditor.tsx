import { insertPointAfter, movePoint, removePoint, type ShapePoint } from "@lintel/builder-model";
import { Minus, Plus } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { classNames } from "../ui/controls.js";

interface PolygonEditorProps {
  label: string;
  points: readonly ShapePoint[];
  onChange: (points: ShapePoint[]) => void;
  disabled?: boolean;
}

/**
 * A square standing for the element, with the shape drawn in it and a handle on each
 * corner. Drag a handle, or focus it and use the arrow keys (Shift for bigger steps), to
 * move that corner; Delete takes it away, and "Add a corner" adds one after it. Corners are
 * in percent of the element, so the shape stretches with it.
 */
export function PolygonEditor({ label, points, onChange, disabled }: PolygonEditorProps) {
  const text = useBuilderText();
  const area = useRef<HTMLDivElement>(null);
  const handles = useRef<Array<HTMLButtonElement | null>>([]);
  const [chosen, setChosen] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);
  const current = Math.min(chosen, points.length - 1);

  const pointAt = (event: PointerEvent): ShapePoint | null => {
    const rect = area.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  };

  const handleKeyDown = (event: KeyboardEvent, index: number) => {
    const distance = event.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-distance, 0],
      ArrowRight: [distance, 0],
      ArrowUp: [0, -distance],
      ArrowDown: [0, distance],
    };
    const step = moves[event.key];
    const point = points[index];
    if (step && point) {
      event.preventDefault();
      onChange(movePoint(points, index, { x: point.x + step[0], y: point.y + step[1] }));
    } else if ((event.key === "Delete" || event.key === "Backspace") && points.length > 3) {
      event.preventDefault();
      onChange(removePoint(points, index));
      setChosen(Math.max(0, index - 1));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption text-label-secondary">{label}</span>
      <div
        ref={area}
        role="group"
        aria-label={label}
        className="relative aspect-square w-full max-w-56 touch-none rounded-control bg-fill"
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-0 size-full"
        >
          <polygon
            points={points.map((point) => `${point.x},${point.y}`).join(" ")}
            className="fill-[var(--color-accent-fill)] opacity-30"
          />
          <polygon
            points={points.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            vectorEffect="non-scaling-stroke"
            className="stroke-[var(--color-accent-fill)]"
            strokeWidth={1.5}
          />
        </svg>
        {points.map((point, index) => (
          <button
            key={index}
            ref={(element) => {
              handles.current[index] = element;
            }}
            type="button"
            disabled={disabled}
            aria-label={text("pageBuilder.design.corner", {
              number: index + 1,
              count: points.length,
              across: Math.round(point.x),
              down: Math.round(point.y),
            })}
            onFocus={() => setChosen(index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setChosen(index);
              setDragging(index);
            }}
            onPointerMove={(event) => {
              if (dragging !== index) return;
              const next = pointAt(event);
              if (next) onChange(movePoint(points, index, next));
            }}
            onPointerUp={() => setDragging(null)}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            className={classNames(
              "absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-thumb focus-visible:focus-ring",
              index === current ? "bg-accent-fill" : "bg-label-secondary",
            )}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onChange(insertPointAfter(points, current));
            setChosen(current + 1);
          }}
          className="flex h-7 items-center gap-1 rounded-control bg-fill px-2.5 text-caption font-medium text-label hover:bg-fill-strong focus-visible:focus-ring disabled:opacity-40"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          {text("pageBuilder.design.addCorner")}
        </button>
        <button
          type="button"
          disabled={disabled || points.length <= 3}
          onClick={() => {
            onChange(removePoint(points, current));
            setChosen(Math.max(0, current - 1));
          }}
          className="flex h-7 items-center gap-1 rounded-control bg-fill px-2.5 text-caption font-medium text-label hover:bg-fill-strong focus-visible:focus-ring disabled:opacity-40"
        >
          <Minus aria-hidden="true" className="size-3.5" />
          {text("pageBuilder.design.removeCorner")}
        </button>
      </div>
      <p className="text-caption text-label-tertiary">{text("pageBuilder.design.cornerHint")}</p>
    </div>
  );
}
