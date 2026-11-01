import { ChevronDown } from "lucide-react";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { booleanValue } from "./fieldValues.js";

/**
 * A "Show more" button. Its on/off value is what other fields' conditions look at, so pressing
 * it shows (or hides) them; it is saved, so the entry opens the way it was left.
 */
export function RevealerFieldEditor({
  field,
  value,
  onChange,
  controlId,
  describedBy,
}: FieldEditorProps) {
  const isOpen = booleanValue(value);
  const words = field.options.buttonLabel || field.label || t("fields.revealer.show");
  return (
    <button
      id={controlId}
      type="button"
      aria-expanded={isOpen}
      aria-describedby={describedBy}
      onClick={() => onChange(!isOpen)}
      className="inline-flex h-8 w-fit items-center gap-1.5 rounded-full bg-fill px-3.5 text-footnote font-medium text-label transition-colors duration-150 ease-standard hover:bg-fill/70 focus-visible:focus-ring"
    >
      {isOpen ? t("fields.revealer.hide", { words }) : words}
      <ChevronDown
        aria-hidden="true"
        strokeWidth={2}
        className={classNames(
          "size-4 motion-safe:transition-transform motion-safe:duration-200",
          isOpen && "rotate-180",
        )}
      />
    </button>
  );
}

/** Tabs, section headings, spacers and hidden values are drawn by the grid, or not at all. */
export function NothingToEdit() {
  return null;
}
