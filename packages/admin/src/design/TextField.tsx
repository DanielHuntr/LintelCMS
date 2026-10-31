import { useId, type InputHTMLAttributes } from "react";
import { classNames } from "./classNames.js";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  /** Always visible above the field. */
  label: string;
  /** Extra guidance under the field, e.g. "At least 12 characters". */
  hint?: string;
  /** Replaces the hint and marks the field invalid when set. */
  error?: string;
}

/** A labelled text input. Hints and errors are linked with aria-describedby so screen readers read them. */
export function TextField({ label, hint, error, className, ...inputProps }: TextFieldProps) {
  const inputId = useId();
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
        className={classNames(
          "h-10 w-full rounded-control bg-fill px-3 text-body text-label",
          "placeholder:text-label-tertiary transition-shadow duration-150 ease-standard",
          "focus:focus-ring focus:outline-offset-0",
          error && "ring-1 ring-danger",
        )}
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
