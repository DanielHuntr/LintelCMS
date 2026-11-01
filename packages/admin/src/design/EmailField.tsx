import { useRef, useState, type ComponentProps } from "react";
import { t } from "../i18n/strings.js";
import { Button } from "./Button.js";
import { suggestEmailCorrection } from "./suggestEmailCorrection.js";
import { TextField } from "./TextField.js";

type EmailFieldProps = Omit<
  ComponentProps<typeof TextField>,
  "type" | "value" | "onChange" | "onBlur"
> & {
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * An email field that spots typos in the domain ("gmai.com") once the person moves on, and
 * offers the fix as a one-click button. It never blocks anything: the suggestion can be ignored.
 */
export function EmailField({ value, onValueChange, ref, ...fieldProps }: EmailFieldProps) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const inputElement = useRef<HTMLInputElement | null>(null);

  // The field keeps its own handle (to refocus after a fix) and passes it on to the caller's.
  function connectInput(element: HTMLInputElement | null) {
    inputElement.current = element;
    if (typeof ref === "function") ref(element);
    else if (ref) ref.current = element;
  }

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
        ref={connectInput}
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
          <EmailSuggestion suggestion={suggestion} onUse={() => acceptSuggestion(suggestion)} />
        )}
      </div>
    </div>
  );
}

/** "Did you mean daniel@gmail.com?" with a Use button, in a soft pill under the field. */
function EmailSuggestion({ suggestion, onUse }: { suggestion: string; onUse: () => void }) {
  // Split the sentence around its placeholder, so translations can put the address anywhere.
  const [before, after] = t("emailField.suggestion").split("{email}");

  return (
    <div className="mt-2.5 flex w-fit max-w-full items-center gap-3 rounded-full bg-accent/10 py-1 pe-1 ps-4">
      <p className="min-w-0 text-footnote text-label">
        {before}
        <span className="font-semibold break-all">{suggestion}</span>
        {after}
      </p>
      <Button
        size="small"
        onClick={onUse}
        aria-label={t("emailField.useLabel", { email: suggestion })}
      >
        {t("emailField.use")}
      </Button>
    </div>
  );
}
