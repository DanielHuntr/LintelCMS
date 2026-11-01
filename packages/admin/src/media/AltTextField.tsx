import { useId, type TextareaHTMLAttributes } from "react";
import { classNames } from "../design/classNames.js";

interface AltTextFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  /** Guidance shown under the field, linked for screen readers. */
  hint: string;
}

/**
 * A labelled, multi-line field for describing an image. It matches TextField, but alt text
 * often runs to a sentence or two, which a one-line input would hide.
 */
export function AltTextField({ label, hint, className, ...textareaProps }: AltTextFieldProps) {
  const fieldId = useId();
  const hintId = useId();

  return (
    <div className={classNames("flex flex-col gap-1.5", className)}>
      <label htmlFor={fieldId} className="text-footnote font-medium text-label">
        {label}
      </label>
      <textarea
        id={fieldId}
        aria-describedby={hintId}
        rows={3}
        className="w-full resize-none rounded-control bg-fill px-3 py-2 text-body text-label placeholder:text-label-tertiary transition-shadow duration-150 ease-standard focus:focus-ring focus:outline-offset-0"
        {...textareaProps}
      />
      <p id={hintId} className="text-footnote text-label-secondary">
        {hint}
      </p>
    </div>
  );
}
