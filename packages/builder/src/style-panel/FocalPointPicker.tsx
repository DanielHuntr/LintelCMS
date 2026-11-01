import { type KeyboardEvent, type PointerEvent, useRef } from "react";
import { useBuilderText } from "../i18n/builder-text.js";

/**
 * A picture with a cross on the part that matters most (the focal point). Click the picture,
 * or focus it and use the arrow keys, to move the cross; the background (or the picture in
 * its frame) keeps that part in view however it's cropped. The value is CSS's `x% y%`.
 */
export function FocalPointPicker({
  label,
  src,
  value,
  onChange,
}: {
  label: string;
  src: string;
  value: string | undefined;
  onChange: (position: string) => void;
}) {
  const text = useBuilderText();
  const area = useRef<HTMLDivElement>(null);
  const match = /^(-?[\d.]+)%\s+(-?[\d.]+)%$/.exec(value ?? "");
  const x = match ? Number(match[1]) : 50;
  const y = match ? Number(match[2]) : 50;
  const set = (nextX: number, nextY: number) => {
    const clamp = (number: number) => Math.round(Math.min(100, Math.max(0, number)));
    onChange(`${clamp(nextX)}% ${clamp(nextY)}%`);
  };
  const pointTo = (event: PointerEvent) => {
    const rect = area.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    set(
      ((event.clientX - rect.left) / rect.width) * 100,
      ((event.clientY - rect.top) / rect.height) * 100,
    );
  };
  const move = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 10 : 2;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = moves[event.key];
    if (!delta) return;
    event.preventDefault();
    set(x + delta[0], y + delta[1]);
  };
  return (
    <div
      ref={area}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuetext={text("pageBuilder.design.focalValue", {
        across: Math.round(x),
        down: Math.round(y),
      })}
      aria-valuenow={Math.round(x)}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pointTo(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons === 1) pointTo(event);
      }}
      onKeyDown={move}
      className="relative w-full max-w-56 cursor-crosshair touch-none overflow-hidden rounded-control bg-fill focus-visible:focus-ring"
    >
      <img src={src} alt="" className="block w-full" draggable={false} />
      <span
        aria-hidden="true"
        style={{ left: `${x}%`, top: `${y}%` }}
        className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-thumb ring-2 ring-black/30"
      />
    </div>
  );
}
