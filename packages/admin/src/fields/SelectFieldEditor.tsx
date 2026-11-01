import { Check, ChevronsUpDown } from "lucide-react";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { t } from "../i18n/strings.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { selectedValues, toggleChoice } from "./fieldValues.js";

/**
 * One choice from a list (a native select, so it works everywhere and on every device), or,
 * when the field allows several, a list of checkboxes so every choice is visible at once.
 */
export function SelectFieldEditor(props: FieldEditorProps) {
  return props.field.options.multiple ? <MultipleChoice {...props} /> : <SingleChoice {...props} />;
}

function SingleChoice({
  field,
  value,
  onChange,
  controlId,
  describedBy,
  hasError,
}: FieldEditorProps) {
  const [selected = ""] = selectedValues(value);
  const choices = field.options.choices ?? [];

  return (
    <div className="relative max-w-sm">
      <select
        id={controlId}
        value={selected}
        onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
        aria-required={field.required || undefined}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        className={classNames("h-10 appearance-none pr-9", controlClasses({ hasError }))}
      >
        {/* Optional fields can go back to having no choice; required ones ask for one. */}
        <option value="" disabled={field.required}>
          {field.required ? t("fields.select.choose") : t("fields.select.none")}
        </option>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
      <ChevronsUpDown
        aria-hidden="true"
        strokeWidth={2}
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-label-secondary"
      />
    </div>
  );
}

function MultipleChoice({ field, value, onChange, controlId }: FieldEditorProps) {
  const selected = selectedValues(value);
  const choices = field.options.choices ?? [];

  return (
    <ul className="flex flex-wrap gap-2">
      {choices.map((choice, index) => {
        const isChecked = selected.includes(choice.value);
        return (
          <li key={choice.value}>
            {/* The checkbox is visually hidden; the pill around it shows its state. */}
            <label
              className={classNames(
                "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-footnote font-medium select-none",
                "transition-colors duration-150 ease-standard has-[:focus-visible]:focus-ring",
                isChecked
                  ? "bg-accent/14 text-accent"
                  : "bg-fill text-label-secondary hover:text-label",
              )}
            >
              <input
                // The first checkbox takes the field's id, so a field error can focus it.
                id={index === 0 ? controlId : undefined}
                type="checkbox"
                checked={isChecked}
                onChange={() => onChange(toggleChoice(choices, selected, choice.value))}
                className="sr-only"
              />
              {isChecked && <Check aria-hidden="true" strokeWidth={2.5} className="size-3.5" />}
              {choice.label}
            </label>
          </li>
        );
      })}
    </ul>
  );
}
