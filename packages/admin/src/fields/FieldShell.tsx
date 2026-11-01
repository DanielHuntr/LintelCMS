import type { ReactNode } from "react";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import { CharacterCount } from "./CharacterCount.js";
import type { Field } from "./field.types.js";
import { textValue } from "./fieldValues.js";

/**
 * How a field's label relates to its control:
 * - "label": one control, named by a `<label>` above it (text, number, select, date...)
 * - "inline": one small control on the same line as its label (a toggle)
 * - "group": several controls under one name, so a fieldset and legend (link, checkboxes, image)
 * - "bare": the editor draws its own label, or nothing at all (a Show more button, a hidden value)
 */
export type FieldLabelling = "label" | "inline" | "group" | "bare";

interface FieldShellProps {
  field: Field;
  labelling: FieldLabelling;
  controlId: string;
  labelId: string;
  helpId: string;
  errorId: string;
  error: string | undefined;
  /** The field's value, for the character count of text fields with a limit. */
  value: unknown;
  children: ReactNode;
}

/**
 * The frame every field editor sits in: label, "Required", help text and error message,
 * all wired to the control for screen readers. Keeping it in one place means every
 * fieldtype looks and reads the same.
 */
export function FieldShell({
  field,
  labelling,
  controlId,
  labelId,
  helpId,
  errorId,
  error,
  value,
  children,
}: FieldShellProps) {
  const { maxLength } = field.options;
  const showsCount =
    maxLength !== undefined &&
    (field.type === "text" || field.type === "textarea" || field.type === "markdown");
  const helpAbove = field.helpTextPosition === "above" && Boolean(field.helpText);
  const labelText = (
    <>
      {field.label}
      {/* The space keeps "Excerpt Required" two words for screen readers. */}
      {field.required && " "}
      {field.required && (
        <span className="ml-0.5 font-normal text-label-tertiary">{t("fields.required")}</span>
      )}
      {field.readOnly && " "}
      {field.readOnly && (
        <span className="ml-0.5 font-normal text-label-tertiary">{t("fields.readOnly")}</span>
      )}
    </>
  );
  const labelClasses = "text-footnote font-medium text-label";
  const helpText = field.helpText && (
    <p id={helpId} className="text-footnote text-label-secondary">
      {field.helpText}
    </p>
  );
  // A read-only field's controls are disabled together; the value still shows.
  const control = field.readOnly ? (
    <fieldset disabled className="contents">
      {children}
    </fieldset>
  ) : (
    children
  );

  const messages = (
    <>
      {((field.helpText && !helpAbove) || showsCount) && (
        <div className="flex items-start justify-between gap-4">
          {!helpAbove && helpText}
          {showsCount && <CharacterCount length={textValue(value).length} maxLength={maxLength} />}
        </div>
      )}
      {error && (
        <p id={errorId} className="text-footnote font-medium text-danger">
          {error}
        </p>
      )}
    </>
  );

  if (labelling === "bare") {
    return (
      <div data-field-handle={field.handle} className="flex min-w-0 flex-col gap-1.5">
        {control}
        {messages}
      </div>
    );
  }

  if (labelling === "group") {
    return (
      <fieldset
        data-field-handle={field.handle}
        aria-describedby={describedByIds(field, error, helpId, errorId)}
        className="flex min-w-0 flex-col gap-1.5"
      >
        <legend id={labelId} className={classNames(labelClasses, "mb-1.5")}>
          {labelText}
        </legend>
        {helpAbove && helpText}
        {control}
        {messages}
      </fieldset>
    );
  }

  return (
    <div data-field-handle={field.handle} className="flex min-w-0 flex-col gap-1.5">
      <div className={labelling === "inline" ? "flex items-center justify-between gap-4" : ""}>
        <label id={labelId} htmlFor={controlId} className={labelClasses}>
          {labelText}
        </label>
        {labelling === "inline" && control}
      </div>
      {helpAbove && helpText}
      {labelling === "label" && control}
      {messages}
    </div>
  );
}

/** The ids `aria-describedby` should list, or undefined when there is nothing to describe. */
export function describedByIds(
  field: Field,
  error: string | undefined,
  helpId: string,
  errorId: string,
): string | undefined {
  const ids = [field.helpText ? helpId : null, error ? errorId : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}
