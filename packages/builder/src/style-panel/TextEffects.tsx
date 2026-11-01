import { fluidSize, readFluidSize } from "@lintel/builder-model";
import { useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { inputClassName, Labelled } from "../ui/controls.js";
import { useStyleEditing, useStyleField } from "./style-field.js";
import { StyleChips, StyleSelect, StyleTextInput } from "./StyleInputs.js";

/**
 * Text that grows with the screen: the size on a phone and on a wide screen, in pixels, and
 * smoothly in between (a CSS `clamp()`). The friendliest way to get very big type that still
 * fits on a phone.
 */
export function FluidSizeControl() {
  const text = useBuilderText();
  const field = useStyleField("fontSize", text("pageBuilder.design.fluidSize"));
  const fluid = readFluidSize(field.value);
  const [isOn, setIsOn] = useState(fluid !== null);
  const smallest = Math.round((fluid?.smallest ?? 2) * 16);
  const largest = Math.round((fluid?.largest ?? 4) * 16);
  const save = (small: number, large: number) => {
    if (!Number.isFinite(small) || !Number.isFinite(large) || small <= 0 || large <= 0) return;
    field.set(fluidSize(Math.min(small, large) / 16, Math.max(small, large) / 16));
  };
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-footnote text-label">
        <input
          type="checkbox"
          checked={isOn || fluid !== null}
          onChange={(event) => {
            setIsOn(event.target.checked);
            if (event.target.checked) save(smallest, largest);
            else field.reset();
          }}
          className="size-4 accent-[var(--color-accent-fill)]"
        />
        {text("pageBuilder.design.fluidSize")}
      </label>
      {(isOn || fluid !== null) && (
        <div className="grid grid-cols-2 gap-2">
          <Labelled label={text("pageBuilder.design.fluidPhone")}>
            {(id) => (
              <input
                id={id}
                type="number"
                min={8}
                max={400}
                key={`small-${smallest}`}
                defaultValue={smallest}
                onBlur={(event) => save(Number(event.target.value), largest)}
                className={inputClassName}
              />
            )}
          </Labelled>
          <Labelled label={text("pageBuilder.design.fluidWide")}>
            {(id) => (
              <input
                id={id}
                type="number"
                min={8}
                max={600}
                key={`large-${largest}`}
                defaultValue={largest}
                onBlur={(event) => save(smallest, Number(event.target.value))}
                className={inputClassName}
              />
            )}
          </Labelled>
        </div>
      )}
    </div>
  );
}

/** Outlined (hollow) letters, one tap away: a stroke, and a see-through fill. */
export function OutlineChips() {
  const text = useBuilderText();
  const { change } = useStyleEditing();
  const label = text("pageBuilder.design.outline");
  const stroke = useStyleField("textStroke", label);
  const width = stroke.value?.split(/\s+/)[0];
  const choices = [
    { width: undefined, label: text("pageBuilder.style.none") },
    { width: "1px", label: text("pageBuilder.design.outlineThin") },
    { width: "2px", label: text("pageBuilder.design.outlineThick") },
  ];
  return (
    <Labelled label={label} onReset={stroke.reset} resetLabel={text("pageBuilder.style.reset")}>
      {() => (
        <div role="group" aria-label={label} className="flex flex-wrap gap-1">
          {choices.map((choice) => (
            <button
              key={choice.label}
              type="button"
              aria-pressed={choice.width === width}
              onClick={() =>
                change(
                  choice.width
                    ? { textStroke: `${choice.width} currentColor`, textFillColor: "transparent" }
                    : { textStroke: undefined, textFillColor: undefined },
                  label,
                )
              }
              className="h-7 rounded-control bg-fill px-2.5 text-caption font-medium text-label aria-pressed:bg-accent-fill aria-pressed:text-on-accent focus-visible:focus-ring"
            >
              {choice.label}
            </button>
          ))}
        </div>
      )}
    </Labelled>
  );
}

/** The outline's own colour, keeping its width (`2px #ff3b30`). */
function OutlineColour() {
  const text = useBuilderText();
  const label = text("pageBuilder.design.outlineColour");
  const field = useStyleField("textStroke", label);
  if (!field.value) return null;
  const [width = "1px", ...rest] = field.value.split(/\s+/);
  const colour = rest.join(" ");
  return (
    <Labelled label={label}>
      {(id) => (
        <input
          id={id}
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(colour) ? colour : "#000000"}
          onChange={(event) => field.set(`${width} ${event.target.value}`)}
          className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
        />
      )}
    </Labelled>
  );
}

/**
 * The finer text effects for Advanced: an outline with its own colour, shadows, vertical
 * text, balanced line breaks and keeping text on one line.
 */
export function AdvancedTextEffects() {
  const text = useBuilderText();
  return (
    <>
      <OutlineChips />
      <OutlineColour />
      <StyleChips
        properties={["textShadow"]}
        label={text("pageBuilder.design.textShadow")}
        choices={[
          { value: undefined, label: text("pageBuilder.style.none") },
          { value: "0 2px 8px rgb(0 0 0 / 0.25)", label: text("pageBuilder.design.shadowSoft") },
          { value: "4px 4px 0 currentColor", label: text("pageBuilder.design.shadowHard") },
          {
            value: "0 0 18px rgb(255 255 255 / 0.8)",
            label: text("pageBuilder.design.shadowGlow"),
          },
        ]}
      />
      <StyleChips
        properties={["writingMode"]}
        label={text("pageBuilder.design.direction")}
        choices={[
          { value: undefined, label: text("pageBuilder.design.directionAcross") },
          { value: "vertical-rl", label: text("pageBuilder.design.directionDown") },
          { value: "sideways-lr", label: text("pageBuilder.design.directionUp") },
        ]}
      />
      <div className="grid grid-cols-2 gap-2">
        <StyleSelect
          property="textOrientation"
          label={text("pageBuilder.design.letters")}
          choices={[
            { value: "mixed", label: text("pageBuilder.design.lettersTurned") },
            { value: "upright", label: text("pageBuilder.design.lettersUpright") },
          ]}
        />
        <StyleSelect
          property="textWrap"
          label={text("pageBuilder.design.lineBreaks")}
          choices={[
            { value: "balance", label: text("pageBuilder.design.lineBreaksBalanced") },
            { value: "pretty", label: text("pageBuilder.design.lineBreaksPretty") },
            { value: "wrap", label: text("pageBuilder.design.lineBreaksNormal") },
          ]}
        />
        <StyleSelect
          property="whiteSpace"
          label={text("pageBuilder.design.oneLine")}
          choices={[
            { value: "nowrap", label: text("pageBuilder.design.oneLineYes") },
            { value: "normal", label: text("pageBuilder.design.oneLineNo") },
          ]}
        />
        <StyleTextInput
          property="textShadow"
          label={text("pageBuilder.design.textShadowExact")}
          placeholder="0 2px 4px #0004"
        />
      </div>
    </>
  );
}
