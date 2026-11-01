import { useId, type InputHTMLAttributes } from "react";
import { classNames } from "./classNames.js";
import { controlClasses } from "./controlStyles.js";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Always visible above the field. */
  label: string;
  /** Extra guidance under the field, e.g. "At least 12 characters". */
  hint?: string;
  /** Replaces the hint and marks the field invalid when set. */
  error?: string;
}

/** A labelled text input. Hints and errors are linked with aria-describedby so screen readers read them. */
export function TextField({ label, hint, error, className, id, ...inputProps }: TextFieldProps) {
  const generatedId = useId();
  // An id can be passed in when something else needs to find the input, e.g. to focus it.
  const inputId = id ?? generatedId;
  const messageId = useId();
  const message = error ?? hint;

  return (
    <div className={classNames("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-footnote font-medium text-label">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className={classNames("h-10", controlClasses({ hasError: Boolean(error) }))}
        {...inputProps}
      />
      {message && (
        <p
          id={messageId}
          className={classNames("text-footnote", error ? "text-danger" : "text-label-secondary")}
        >
          {message}
        </p>
      )}
    </div>
  );
}
