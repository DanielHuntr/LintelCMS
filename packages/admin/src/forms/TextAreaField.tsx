import { useId, type TextareaHTMLAttributes } from "react";
import { controlClasses } from "../design/controlStyles.js";
import { classNames } from "../design/classNames.js";

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

/** A labelled text area that looks like TextField, for longer text such as messages. */
export function TextAreaField({ label, hint, error, className, ...props }: TextAreaFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-footnote text-label">
        {label}
      </label>
      <textarea
        id={id}
        aria-describedby={hint || error ? hintId : undefined}
        aria-invalid={error ? true : undefined}
        className={classNames(
          controlClasses({ hasError: Boolean(error) }),
          "min-h-24 py-2",
          className,
        )}
        {...props}
      />
      {(error ?? hint) && (
        <p
          id={hintId}
          className={classNames("text-footnote", error ? "text-danger" : "text-label-secondary")}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
