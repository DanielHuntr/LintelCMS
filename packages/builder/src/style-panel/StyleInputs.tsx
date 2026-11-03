import {
  type DesignToken,
  findTokenByValue,
  type StylePropertyName,
  tokenValue,
} from "@lintel/builder-model";
import { Check } from "lucide-react";
import { useId, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { classNames, inputClassName, Labelled } from "../ui/controls.js";
import {
  normaliseTypedValue,
  overrideNoteFor,
  useStyleEditing,
  useStyleField,
} from "./style-field.js";

/** The controls the Style panel is made of. Each edits one property (or a few together). */

interface StyleControlProps {
  property: StylePropertyName;
  label: string;
}

/** Shows the dot and Reset when the value is changed for this screen size or state. */
function useOverrideNote(isOverridden: boolean) {
  const text = useBuilderText();
  const { target } = useStyleEditing();
  return isOverridden ? text(overrideNoteFor(target)) : undefined;
}

/** Free text, applied on Enter or when leaving the box. Bare numbers become pixels. */
export function StyleTextInput({
  property,
  label,
  placeholder,
}: StyleControlProps & { placeholder?: string }) {
  const text = useBuilderText();
  const field = useStyleField(property, label);
  const [draft, setDraft] = useState(field.value ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const errorId = useId();
  // When the value changes from outside (undo, another screen size), show the new one.
  const [shownValue, setShownValue] = useState(field.value);
  if (shownValue !== field.value) {
    setShownValue(field.value);
    setDraft(field.value ?? "");
  }

  const commit = () => {
    const value = normaliseTypedValue(property, draft);
    if (value === null) {
      setProblem(text("pageBuilder.style.invalidValue"));
      return;
    }
    setProblem(null);
    if (value !== field.value) field.set(value);
  };

  return (
    <Labelled
      label={label}
      overridden={useOverrideNote(field.isOverridden)}
      onReset={field.reset}
      resetLabel={text("pageBuilder.style.reset")}
    >
      {(id) => (
        <>
          <input
            id={id}
            value={draft}
            placeholder={placeholder ?? text("pageBuilder.style.auto")}
            aria-invalid={problem !== null}
            aria-describedby={problem ? errorId : undefined}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
              if (event.key === "Escape") setDraft(field.value ?? "");
            }}
            className={classNames(inputClassName, problem && "focus-ring-danger")}
          />
          {problem && (
            <span id={errorId} className="text-caption text-danger">
              {problem}
            </span>
          )}
        </>
      )}
    </Labelled>
  );
}

/** A dropdown of fixed choices, with "Not set" first. */
export function StyleSelect({
  property,
  label,
  choices,
}: StyleControlProps & { choices: readonly { value: string; label: string }[] }) {
  const text = useBuilderText();
  const field = useStyleField(property, label);
  const known = choices.some((choice) => choice.value === field.value);
  return (
    <Labelled
      label={label}
      overridden={useOverrideNote(field.isOverridden)}
      onReset={field.reset}
      resetLabel={text("pageBuilder.style.reset")}
    >
      {(id) => (
        <select
          id={id}
          value={field.value ?? ""}
          onChange={(event) => field.set(event.target.value || undefined)}
          className={inputClassName}
        >
          <option value="">{text("pageBuilder.style.notSet")}</option>
          {!known && field.value && <option value={field.value}>{field.value}</option>}
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      )}
    </Labelled>
  );
}

interface ChipChoice {
  value: string | undefined;
  label: string;
}

/**
 * A row of one-tap choices ("None, S, M, L"): the friendly control Simple mode is made of.
 * `properties` lets one chip set several properties, such as padding on all four sides.
 */
export function StyleChips({
  properties,
  label,
  choices,
  lookValue = null,
}: {
  properties: readonly StylePropertyName[];
  label: string;
  choices: readonly ChipChoice[];
  /**
   * The choice that matches how the element looks on the canvas, shown pressed while nothing
   * is set on it. Null when the look isn't known or matches no choice.
   */
  lookValue?: string | undefined | null;
}) {
  const text = useBuilderText();
  const { change } = useStyleEditing();
  const first = useStyleField(properties[0] as StylePropertyName, label);
  const labelId = useId();
  return (
    <Labelled
      label={label}
      overridden={useOverrideNote(first.isOverridden)}
      onReset={() =>
        change(Object.fromEntries(properties.map((property) => [property, undefined])), label)
      }
      resetLabel={text("pageBuilder.style.reset")}
    >
      {() => (
        <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-1">
          <span id={labelId} className="sr-only">
            {label}
          </span>
          {choices.map((choice) => {
            // A value no chip matches (a size that grows with the screen, say) shows the chip
            // nearest how it looks, as nothing set does.
            const isChipValue = choices.some((each) => each.value === first.value);
            const shown =
              (first.value !== undefined && isChipValue) || lookValue === null
                ? first.value
                : lookValue;
            const isCurrent = choice.value === shown;
            return (
              <button
                key={choice.label}
                type="button"
                aria-pressed={isCurrent}
                onClick={() =>
                  change(
                    Object.fromEntries(properties.map((property) => [property, choice.value])),
                    label,
                  )
                }
                className={classNames(
                  "h-7 rounded-control px-2.5 text-caption font-medium transition-colors duration-150 focus-visible:focus-ring",
                  isCurrent
                    ? "bg-accent-fill text-on-accent"
                    : "bg-fill text-label hover:bg-fill-strong",
                )}
              >
                {choice.label}
              </button>
            );
          })}
        </div>
      )}
    </Labelled>
  );
}

/** Chips made from design tokens (spacing steps, radii), with "None" first. */
export function tokenChips(
  tokens: readonly DesignToken[],
  noneLabel: string,
  none = "0",
): ChipChoice[] {
  return [
    { value: none, label: noneLabel },
    ...tokens.map((token) => ({ value: tokenValue(token), label: token.label })),
  ];
}

/** The theme's colours as swatches, plus a custom colour. Names are spoken and shown on hover. */
export function ColourPicker({
  property,
  label,
  tokens,
}: StyleControlProps & { tokens: readonly DesignToken[] }) {
  const text = useBuilderText();
  const field = useStyleField(property, label);
  const labelId = useId();
  const current = findTokenByValue(field.value, tokens);
  const custom =
    field.value && !current && /^#[0-9a-f]{6}$/i.test(field.value) ? field.value : "#000000";
  return (
    <Labelled
      label={label}
      overridden={useOverrideNote(field.isOverridden)}
      onReset={field.reset}
      resetLabel={text("pageBuilder.style.reset")}
    >
      {(id) => (
        <div role="group" aria-labelledby={labelId} className="flex flex-wrap items-center gap-1.5">
          <span id={labelId} className="sr-only">
            {label}
          </span>
          {tokens.map((token) => {
            const isCurrent = current?.name === token.name;
            return (
              <button
                key={token.name}
                type="button"
                title={token.label}
                aria-label={token.label}
                aria-pressed={isCurrent}
                onClick={() => field.set(tokenValue(token))}
                style={{ backgroundColor: token.fallback }}
                className="flex size-6 items-center justify-center rounded-full hairline-ring focus-visible:focus-ring"
              >
                {isCurrent && (
                  <Check aria-hidden="true" className="size-3.5 text-white mix-blend-difference" />
                )}
              </button>
            );
          })}
          <label className="flex items-center gap-1 text-caption text-label-secondary">
            <input
              id={id}
              type="color"
              value={custom}
              onChange={(event) => field.set(event.target.value)}
              className="size-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
            />
            {text("pageBuilder.style.customColour")}
          </label>
          {current && (
            // The swatches' names are only in tooltips, so the chosen one is named here too.
            <span aria-hidden="true" className="basis-full text-caption text-label-secondary">
              {current.label}
            </span>
          )}
        </div>
      )}
    </Labelled>
  );
}

/**
 * A slider for a number with a unit (degrees, percent, pixels), with the value shown beside
 * it. At `neutral` the property is cleared rather than stored, so untouched elements stay
 * clean. The arrow keys move it by `step`, as with any range input.
 */
export function StyleSlider({
  property,
  label,
  min,
  max,
  step,
  unit,
  neutral,
}: StyleControlProps & { min: number; max: number; step: number; unit: string; neutral: number }) {
  const text = useBuilderText();
  const field = useStyleField(property, label);
  const parsed = Number.parseFloat(field.value ?? "");
  const current = Number.isFinite(parsed) ? parsed : neutral;
  return (
    <Labelled
      label={label}
      overridden={useOverrideNote(field.isOverridden)}
      onReset={field.reset}
      resetLabel={text("pageBuilder.style.reset")}
    >
      {(id) => (
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="range"
            min={min}
            max={max}
            step={step}
            value={Math.min(max, Math.max(min, current))}
            aria-valuetext={`${current}${unit}`}
            onChange={(event) => {
              const value = Number(event.target.value);
              field.set(value === neutral ? undefined : `${value}${unit}`);
            }}
            className="flex-1 accent-[var(--color-accent-fill)]"
          />
          <span className="w-12 text-end text-caption text-label-secondary">
            {current}
            {unit}
          </span>
        </div>
      )}
    </Labelled>
  );
}
