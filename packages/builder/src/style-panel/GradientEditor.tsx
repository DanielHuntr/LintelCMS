import type { Gradient, GradientStop } from "@lintel/builder-model";
import { Plus, Trash2 } from "lucide-react";
import { useBuilderText } from "../i18n/builder-text.js";
import { ChoiceGroup, IconButton, Labelled } from "../ui/controls.js";

/**
 * A gradient as a few plain controls: straight or round, which way it runs, and its colours
 * with where each one sits. A preview strip shows the result.
 */
export function GradientEditor({
  gradient,
  onChange,
  preview,
}: {
  gradient: Gradient;
  onChange: (gradient: Gradient) => void;
  /** The CSS of the gradient, for the preview strip. */
  preview: string;
}) {
  const text = useBuilderText();
  const changeStop = (index: number, stop: GradientStop) =>
    onChange({
      ...gradient,
      stops: gradient.stops.map((current, position) => (position === index ? stop : current)),
    });

  return (
    <div className="flex flex-col gap-2">
      <div
        aria-hidden="true"
        className="h-6 rounded-control hairline-ring"
        style={{ backgroundImage: preview }}
      />
      <ChoiceGroup<Gradient["type"]>
        label={text("pageBuilder.design.gradientType")}
        value={gradient.type}
        onChange={(type) => onChange({ ...gradient, type })}
        choices={[
          { value: "linear", label: text("pageBuilder.design.gradientLinear") },
          { value: "radial", label: text("pageBuilder.design.gradientRadial") },
        ]}
      />
      {gradient.type === "linear" && (
        <Labelled label={text("pageBuilder.design.gradientAngle")}>
          {(id) => (
            <div className="flex items-center gap-2">
              <input
                id={id}
                type="range"
                min={0}
                max={360}
                step={5}
                value={gradient.angle}
                aria-valuetext={`${gradient.angle}°`}
                onChange={(event) => onChange({ ...gradient, angle: Number(event.target.value) })}
                className="flex-1 accent-[var(--color-accent-fill)]"
              />
              <span className="w-10 text-right text-caption text-label-secondary">
                {gradient.angle}°
              </span>
            </div>
          )}
        </Labelled>
      )}
      <ol className="flex flex-col gap-1.5" aria-label={text("pageBuilder.design.gradientColours")}>
        {gradient.stops.map((stop, index) => (
          <li key={index} className="flex items-center gap-2">
            <input
              type="color"
              aria-label={text("pageBuilder.design.gradientColour", { number: index + 1 })}
              value={/^#[0-9a-f]{6}$/i.test(stop.colour) ? stop.colour : "#000000"}
              onChange={(event) => changeStop(index, { ...stop, colour: event.target.value })}
              className="size-6 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0"
            />
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              aria-label={text("pageBuilder.design.gradientWhere", { number: index + 1 })}
              aria-valuetext={`${Math.round(stop.at)}%`}
              value={stop.at}
              onChange={(event) => changeStop(index, { ...stop, at: Number(event.target.value) })}
              className="flex-1 accent-[var(--color-accent-fill)]"
            />
            <IconButton
              icon={Trash2}
              size="small"
              label={text("pageBuilder.design.gradientRemoveColour", { number: index + 1 })}
              disabled={gradient.stops.length <= 2}
              onClick={() =>
                onChange({
                  ...gradient,
                  stops: gradient.stops.filter((_, position) => position !== index),
                })
              }
            />
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() =>
          onChange({ ...gradient, stops: [...gradient.stops, { colour: "#ffffff", at: 100 }] })
        }
        className="flex h-7 items-center gap-1 self-start rounded-control bg-fill px-2.5 text-caption font-medium text-label hover:bg-fill-strong focus-visible:focus-ring"
      >
        <Plus aria-hidden="true" className="size-3.5" />
        {text("pageBuilder.design.gradientAddColour")}
      </button>
    </div>
  );
}
