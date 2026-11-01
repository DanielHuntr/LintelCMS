import {
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from "react";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";

/** A labelled select and text area that look like TextField, for the step editor. */

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  children: ReactNode;
}

export function SelectField({
  label,
  hint,
  children,
  className,
  ...selectProps
}: SelectFieldProps) {
  const id = useId();
  const hintId = useId();
  return (
    <div className={classNames("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-footnote font-medium text-label">
        {label}
      </label>
      <select
        id={id}
        aria-describedby={hint ? hintId : undefined}
        className={classNames(controlClasses(), "h-10")}
        {...selectProps}
      >
        {children}
      </select>
      {hint && (
        <p id={hintId} className="text-footnote text-label-secondary">
          {hint}
        </p>
      )}
    </div>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  /** Monospaced, for JSON. */
  code?: boolean;
}

export function TextAreaField({
  label,
  hint,
  code = false,
  className,
  ...areaProps
}: TextAreaFieldProps) {
  const id = useId();
  const hintId = useId();
  return (
    <div className={classNames("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-footnote font-medium text-label">
        {label}
      </label>
      <textarea
        id={id}
        aria-describedby={hint ? hintId : undefined}
        rows={4}
        className={classNames(controlClasses(), "py-2", code && "font-mono text-footnote")}
        {...areaProps}
      />
      {hint && (
        <p id={hintId} className="text-footnote text-label-secondary">
          {hint}
        </p>
      )}
    </div>
  );
}
