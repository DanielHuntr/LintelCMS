import { useRef, useState, type ComponentProps } from "react";
import { t } from "../i18n/strings.js";
import { suggestEmailCorrection } from "./suggestEmailCorrection.js";
import { TextField } from "./TextField.js";

type EmailFieldProps = Omit<
  ComponentProps<typeof TextField>,
  "type" | "value" | "onChange" | "onBlur" | "ref"
> & {
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * An email field that spots typos in the domain ("gmai.com") once the person moves on, and
 * offers the fix as a one-click button. It never blocks anything: the suggestion can be ignored.
 */
export function EmailField({ value, onValueChange, ...fieldProps }: EmailFieldProps) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const inputElement = useRef<HTMLInputElement>(null);

  function acceptSuggestion(correctedEmail: string) {
    onValueChange(correctedEmail);
    setSuggestion(null);
    // The button disappears once used, so put focus back where the person was working.
    inputElement.current?.focus();
  }

  return (
    <div className="flex flex-col">
      <TextField
        {...fieldProps}
        ref={inputElement}
        type="email"
        value={value}
        // Checking while someone is still typing would flag every half-typed address.
        onBlur={() => setSuggestion(suggestEmailCorrection(value))}
        onChange={(event) => {
          onValueChange(event.target.value);
          setSuggestion(null);
        }}
      />
      {/* Always rendered, so screen readers hear the suggestion when it appears after Tab. */}
      <div aria-live="polite">
        {suggestion && (
          <button
            type="button"
            onClick={() => acceptSuggestion(suggestion)}
            className="-mx-1 mt-1.5 rounded-control px-1 text-left text-footnote font-medium text-accent transition-colors duration-150 ease-standard hover:underline focus-visible:focus-ring"
          >
            {t("emailField.suggestion", { email: suggestion })}
          </button>
        )}
      </div>
    </div>
  );
}
