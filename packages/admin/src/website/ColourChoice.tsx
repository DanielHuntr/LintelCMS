import { useId, useState } from "react";
import { controlClasses } from "../design/controlStyles.js";
import { isHexColour } from "../fields/fieldValues.js";
import { t } from "../i18n/strings.js";

interface ColourChoiceProps {
  label: string;
  hint: string;
  value: string;
  disabled: boolean;
  onChange: (colour: string) => void;
}

/**
 * A theme colour: the system colour picker beside its hex code, so a brand colour can be
 * picked by eye or pasted exactly. The site keeps text readable on any colour chosen.
 */
export function ColourChoice({ label, hint, value, disabled, onChange }: ColourChoiceProps) {
  const id = useId();
  // Kept here so a half-typed code ("#1a2") isn't thrown away; it's used once it's whole.
  const [typed, setTyped] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setTyped(value);
  }

  function type(text: string) {
    setTyped(text);
    if (isHexColour(text)) onChange(text.trim().toLowerCase());
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-footnote font-medium text-label">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={t("website.colourPicker", { label })}
          value={isHexColour(value) ? value : "#000000"}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-control bg-fill p-1 focus-visible:focus-ring disabled:cursor-default"
        />
        <div className="w-32 shrink-0">
          <input
            id={id}
            value={typed}
            disabled={disabled}
            spellCheck={false}
            aria-describedby={`${id}-hint`}
            aria-invalid={!isHexColour(typed)}
            onChange={(event) => type(event.target.value)}
            className={controlClasses({ hasError: !isHexColour(typed) })}
          />
        </div>
      </div>
      <p id={`${id}-hint`} className="text-footnote text-label-secondary">
        {isHexColour(typed) ? hint : t("website.colourFormat")}
      </p>
    </div>
  );
}
