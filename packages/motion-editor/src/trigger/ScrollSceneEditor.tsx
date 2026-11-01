import type { ScrollMarker, ScrollTrigger } from "@lintel/motion";
import { useRef, type PointerEvent } from "react";
import { Slider } from "../controls/Slider.js";
import { useTranslate } from "../strings/translate.js";

/**
 * Where a scroll scene starts and ends, drawn as a screen with the element passing through.
 * Each marker is "when this part of the element reaches this part of the screen". Drag the
 * marker lines on the screen, or use the sliders (which also work by keyboard).
 */

interface ScrollSceneEditorProps {
  trigger: ScrollTrigger;
  onChange: (trigger: ScrollTrigger, mergeKey?: string) => void;
  onCommit: () => void;
}

const screen = { x: 20, y: 20, width: 120, height: 200 };
const elementHeight = 50;

type MarkerName = "start" | "end";

function percent(fraction: number) {
  return Math.round(fraction * 100);
}

export function ScrollSceneEditor({ trigger, onChange, onCommit }: ScrollSceneEditorProps) {
  const t = useTranslate();
  const svg = useRef<SVGSVGElement>(null);

  const setMarker = (name: MarkerName, marker: ScrollMarker) =>
    onChange({ ...trigger, [name]: marker }, `scene-${name}`);

  function dragMarker(event: PointerEvent<SVGGElement>, name: MarkerName) {
    const box = svg.current?.getBoundingClientRect();
    if (!box || event.buttons !== 1) return;
    const scale = box.height / 240;
    const fraction = (event.clientY - box.top - screen.y * scale) / (screen.height * scale);
    setMarker(name, {
      ...trigger[name],
      viewport: Math.round(Math.min(Math.max(fraction, 0), 1) * 100) / 100,
    });
  }

  const lineY = (marker: ScrollMarker) => screen.y + marker.viewport * screen.height;
  const elementTop = (marker: ScrollMarker) => lineY(marker) - marker.element * elementHeight;
  const colours: Record<MarkerName, string> = {
    start: "var(--color-success)",
    end: "var(--color-danger)",
  };

  if (trigger.pin) {
    return (
      <p className="text-footnote text-label-secondary">
        {t("motionEditor.scene.pinnedExplainer")}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-5">
      <svg
        ref={svg}
        viewBox="0 0 220 240"
        className="h-60 w-56 shrink-0 touch-none select-none"
        role="img"
        aria-label={t("motionEditor.scene.diagram", {
          start: percent(trigger.start.viewport),
          end: percent(trigger.end.viewport),
        })}
      >
        <rect {...screen} rx="10" fill="var(--color-fill)" stroke="var(--color-separator)" />
        <text x={screen.x + 6} y={screen.y - 6} fontSize="10" fill="var(--color-label-secondary)">
          {t("motionEditor.scene.screen")}
        </text>
        {(["start", "end"] as const).map((name) => (
          <g key={name}>
            <rect
              x={screen.x + 30}
              y={elementTop(trigger[name])}
              width="60"
              height={elementHeight}
              rx="6"
              fill={colours[name]}
              opacity="0.18"
              stroke={colours[name]}
              strokeDasharray="3 3"
            />
            <g
              className="cursor-ns-resize"
              onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
              onPointerMove={(event) => dragMarker(event, name)}
              onPointerUp={onCommit}
            >
              <line
                x1={screen.x - 8}
                x2={screen.x + screen.width + 8}
                y1={lineY(trigger[name])}
                y2={lineY(trigger[name])}
                stroke={colours[name]}
                strokeWidth="2"
              />
              <rect
                x={screen.x - 8}
                y={lineY(trigger[name]) - 8}
                width={screen.width + 16}
                height="16"
                fill="transparent"
              />
              <text
                x={screen.x + screen.width + 12}
                y={lineY(trigger[name]) + 4}
                fontSize="11"
                fontWeight="600"
                fill={colours[name]}
              >
                {t(name === "start" ? "motionEditor.scene.start" : "motionEditor.scene.end")}
              </text>
            </g>
          </g>
        ))}
      </svg>
      <div className="flex min-w-48 flex-1 flex-col gap-4">
        {(["start", "end"] as const).map((name) => (
          <fieldset key={name} className="flex flex-col gap-3">
            <legend className="mb-1 text-footnote font-semibold text-label">
              {t(
                name === "start" ? "motionEditor.scene.startsWhen" : "motionEditor.scene.endsWhen",
              )}
            </legend>
            <Slider
              label={t("motionEditor.scene.elementPoint")}
              min={0}
              max={1}
              step={0.05}
              value={trigger[name].element}
              minLabel={t("motionEditor.scene.top")}
              maxLabel={t("motionEditor.scene.bottom")}
              displayValue={`${percent(trigger[name].element)}%`}
              valueText={t("motionEditor.scene.elementValue", {
                percent: percent(trigger[name].element),
              })}
              onChange={(element) => setMarker(name, { ...trigger[name], element })}
              onCommit={onCommit}
            />
            <Slider
              label={t("motionEditor.scene.screenPoint")}
              min={0}
              max={1}
              step={0.05}
              value={trigger[name].viewport}
              minLabel={t("motionEditor.scene.top")}
              maxLabel={t("motionEditor.scene.bottom")}
              displayValue={`${percent(trigger[name].viewport)}%`}
              valueText={t("motionEditor.scene.screenValue", {
                percent: percent(trigger[name].viewport),
              })}
              onChange={(viewport) => setMarker(name, { ...trigger[name], viewport })}
              onCommit={onCommit}
            />
          </fieldset>
        ))}
      </div>
    </div>
  );
}
