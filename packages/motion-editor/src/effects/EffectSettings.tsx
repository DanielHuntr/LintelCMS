import type {
  EffectDefinition,
  EffectParameter,
  NodeEffect,
  SettingReactInput,
} from "@lintel/motion/effects";
import { Check, ChevronRight, Pipette } from "lucide-react";
import { useId, useState } from "react";
import { classNames } from "../controls/classNames.js";
import { Checkbox, Select, TextInput } from "../controls/Field.js";
import { Slider } from "../controls/Slider.js";
import { ReactControl } from "../shaders/ReactControl.js";
import { useTranslate } from "../strings/translate.js";
import { themeCursorSwatches, type CursorColourSwatch } from "./CursorLookFields.js";

/**
 * An effect's settings in plain words, for Simple mode: a slider for each number, a menu for
 * each choice, a colour well, a switch or a text box. Every control has a visible label.
 */
interface EffectSettingsProps {
  definition: EffectDefinition;
  values: Readonly<Record<string, number | string | boolean>>;
  onChange: (values: Record<string, number | string | boolean>) => void;
  onCommit?: () => void;
  /** The site's colours, offered for colour settings; the theme's when left out. */
  colours?: readonly CursorColourSwatch[];
  /** What number settings react to. With `onReacts`, each number can be made to react. */
  reacts?: NodeEffect["reacts"];
  onReacts?: (reacts: NodeEffect["reacts"]) => void;
}

function formatNumber(parameter: Extract<EffectParameter, { kind: "number" }>, value: number) {
  const rounded = Math.round(value * 100) / 100;
  return parameter.unit
    ? `${rounded}${parameter.unit === "×" ? "×" : ` ${parameter.unit}`}`
    : String(rounded);
}

/**
 * A colour: the site's colours first (saved by name, so they follow Site styles), "Same as
 * the words" where the effect starts from it, then any colour picked by hand.
 */
function ColourInput({
  label,
  value,
  offerWords,
  offerNone,
  colours,
  onChange,
}: {
  label: string;
  value: string;
  /** Offers the colour of the element's words (`currentColor`). */
  offerWords: boolean;
  /** For a colour that is off until chosen. */
  offerNone: boolean;
  colours: readonly CursorColourSwatch[];
  onChange: (value: string) => void;
}) {
  const t = useTranslate();
  const labelId = useId();
  const current = colours.find((colour) => colour.value === value);
  const words = value === "currentColor";
  const picked = /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
  const chosenName = words ? t("motionEditor.effects.wordsColour") : (current?.label ?? picked);
  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-caption font-medium text-label-secondary">
        {label}
        {chosenName && <span className="font-normal text-label-tertiary"> · {chosenName}</span>}
      </span>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap items-center gap-1.5">
        {offerNone && (
          <button
            type="button"
            aria-pressed={value === ""}
            onClick={() => onChange("")}
            className={classNames(
              "h-6 rounded-full px-2.5 text-caption font-medium focus-visible:focus-ring",
              value === ""
                ? "bg-accent-fill text-on-accent"
                : "bg-fill text-label-secondary hover:bg-fill/70",
            )}
          >
            {t("motionEditor.effects.noColour")}
          </button>
        )}
        {offerWords && (
          <button
            type="button"
            aria-pressed={words}
            onClick={() => onChange("currentColor")}
            className={classNames(
              "h-6 rounded-full px-2.5 text-caption font-medium focus-visible:focus-ring",
              words
                ? "bg-accent-fill text-on-accent"
                : "bg-fill text-label-secondary hover:bg-fill/70",
            )}
          >
            {t("motionEditor.effects.wordsColour")}
          </button>
        )}
        {colours.map((colour) => {
          const chosen = colour.value === value;
          return (
            <button
              key={colour.value}
              type="button"
              title={colour.label}
              aria-label={colour.label}
              aria-pressed={chosen}
              onClick={() => onChange(colour.value)}
              style={{ background: colour.swatch }}
              className="flex size-6 items-center justify-center rounded-full hairline-ring focus-visible:focus-ring"
            >
              {chosen && (
                <Check aria-hidden="true" className="size-3.5 text-white mix-blend-difference" />
              )}
            </button>
          );
        })}
        <span
          style={picked ? { background: picked } : undefined}
          className="relative flex size-6 items-center justify-center rounded-full bg-fill text-label-secondary hairline-ring has-[:focus-visible]:focus-ring"
        >
          {picked ? (
            <Check aria-hidden="true" className="size-3.5 text-white mix-blend-difference" />
          ) : (
            <Pipette aria-hidden="true" className="size-3.5" />
          )}
          <input
            type="color"
            aria-label={t("motionEditor.site.cursor.colourChoice.pick")}
            title={t("motionEditor.site.cursor.colourChoice.pick")}
            value={picked ?? "#7539fd"}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </span>
      </div>
    </div>
  );
}

export function EffectSettings({
  definition,
  values,
  onChange,
  onCommit,
  colours,
  reacts,
  onReacts,
}: EffectSettingsProps) {
  const t = useTranslate();
  const [moreOpen, setMoreOpen] = useState(false);
  const swatches = colours ?? themeCursorSwatches(t);
  const entries = Object.entries(definition.params);
  if (entries.length === 0) return null;
  const set = (name: string, value: number | string | boolean) =>
    onChange({ ...values, [name]: value });
  const setReact = (name: string, react: SettingReactInput | undefined) => {
    const next = { ...reacts };
    if (react) next[name] = react;
    else delete next[name];
    onReacts?.(Object.keys(next).length > 0 ? next : undefined);
  };
  const drawSetting = ([name, parameter]: (typeof entries)[number]) => {
    const value = values[name] ?? parameter.default;
    switch (parameter.kind) {
      case "number": {
        const step = parameter.step ?? (parameter.max - parameter.min > 20 ? 1 : 0.01);
        const slider = (
          <Slider
            key={name}
            label={parameter.label}
            value={Number(value)}
            min={parameter.min}
            max={parameter.max}
            step={step}
            displayValue={formatNumber(parameter, Number(value))}
            valueText={formatNumber(parameter, Number(value))}
            onChange={(next) => set(name, next)}
            onCommit={onCommit}
          />
        );
        if (!onReacts) return slider;
        return (
          <ReactControl
            key={name}
            label={parameter.label}
            min={parameter.min}
            max={parameter.max}
            step={step}
            value={Number(value)}
            react={reacts?.[name]}
            onChange={(react) => setReact(name, react)}
            onCommit={onCommit}
          >
            {slider}
          </ReactControl>
        );
      }
      case "choice":
        return (
          <Select
            key={name}
            label={parameter.label}
            options={parameter.choices}
            value={String(value)}
            onChange={(event) => (set(name, event.target.value), onCommit?.())}
          />
        );
      case "colour":
        return (
          <ColourInput
            key={name}
            label={parameter.label}
            value={String(value)}
            offerWords={parameter.default === "currentColor"}
            offerNone={parameter.default === ""}
            colours={swatches}
            onChange={(next) => (set(name, next), onCommit?.())}
          />
        );
      case "switch":
        return (
          <Checkbox
            key={name}
            label={parameter.label}
            checked={Boolean(value)}
            onChange={(next) => (set(name, next), onCommit?.())}
          />
        );
      case "text":
        return (
          <TextInput
            key={name}
            label={parameter.label}
            value={String(value)}
            maxLength={parameter.maxLength}
            onChange={(event) => set(name, event.target.value)}
            onBlur={onCommit}
          />
        );
    }
    return null;
  };
  const main = entries.filter(([, parameter]) => !parameter.more);
  const folded = entries.filter(([, parameter]) => parameter.more);
  return (
    <div className="flex flex-col gap-3">
      {main.map(drawSetting)}
      {folded.length > 0 && (
        <button
          type="button"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(!moreOpen)}
          className="-mx-1 flex min-h-8 items-center gap-1 rounded-control px-1 text-start text-footnote font-medium text-label-secondary hover:text-label focus-visible:focus-ring"
        >
          <ChevronRight
            aria-hidden="true"
            className={classNames("size-3.5 transition-transform", moreOpen && "rotate-90")}
          />
          {t("motionEditor.panel.moreSettings")}
        </button>
      )}
      {moreOpen && folded.map(drawSetting)}
    </div>
  );
}
