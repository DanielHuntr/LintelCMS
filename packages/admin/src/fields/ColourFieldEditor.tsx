import { Check, X } from "lucide-react";
import { useState } from "react";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { t } from "../i18n/strings.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { isHexColour, textValue } from "./fieldValues.js";

/**
 * A colour: the system colour picker, the hex code (for pasting a brand colour), and the
 * colours suggested in the field's settings as one-click choices.
 */
export function ColourFieldEditor({
  field,
  value,
  onChange,
  controlId,
  describedBy,
  hasError,
}: FieldEditorProps) {
  const saved = textValue(value).toLowerCase();
  // Kept locally so a half-typed code ("#1a2") isn't thrown away; it's saved once it's whole.
  const [typed, setTyped] = useState(saved);
  const swatches = field.options.swatches ?? [];

  function choose(colour: string) {
    setTyped(colour);
    onChange(colour);
  }

  function type(text: string) {
    setTyped(text);
    if (text.trim() === "") onChange(null);
    else if (isHexColour(text)) onChange(text.trim().toLowerCase());
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={t("fields.colour.picker", { label: field.label })}
          value={isHexColour(saved) ? saved : "#000000"}
          onChange={(event) => choose(event.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-control bg-fill p-1 focus-visible:focus-ring"
        />
        {/* Sized by its wrapper: the shared control style makes inputs full width. */}
        <div className="w-32 shrink-0">
          <input
            id={controlId}
            type="text"
            spellCheck={false}
            autoCapitalize="off"
            placeholder="#1a2b3c"
            maxLength={7}
            value={typed}
            onChange={(event) => type(event.target.value)}
            aria-required={field.required || undefined}
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy}
            className={classNames("h-10 font-mono text-footnote", controlClasses({ hasError }))}
          />
        </div>
        {saved !== "" && !field.required && (
          <button
            type="button"
            onClick={() => type("")}
            aria-label={t("fields.colour.clear", { label: field.label })}
            title={t("fields.colour.clear", { label: field.label })}
            className="flex size-8 items-center justify-center rounded-full text-label-secondary hover:bg-fill hover:text-label focus-visible:focus-ring"
          >
            <X aria-hidden="true" strokeWidth={2} className="size-4" />
          </button>
        )}
      </div>
      {swatches.length > 0 && (
        <ul aria-label={t("fields.colour.suggested")} className="flex flex-wrap gap-2">
          {swatches.map((swatch) => {
            const isChosen = swatch.toLowerCase() === saved;
            return (
              <li key={swatch}>
                <button
                  type="button"
                  onClick={() => choose(swatch.toLowerCase())}
                  aria-label={t("fields.colour.useSwatch", { colour: swatch })}
                  aria-pressed={isChosen}
                  style={{ backgroundColor: swatch }}
                  className="flex size-8 items-center justify-center rounded-full shadow-thumb hairline-ring focus-visible:focus-ring"
                >
                  {isChosen && (
                    <Check
                      aria-hidden="true"
                      strokeWidth={3}
                      className="size-4 text-white mix-blend-difference"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
