import { ChevronsUpDown } from "lucide-react";
import { useId, type SelectHTMLAttributes } from "react";
import { classNames } from "./classNames.js";
import { controlClasses } from "./controlStyles.js";

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label: string;
  hint?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  onValueChange: (value: string) => void;
}

/** A labelled native select, which every screen reader and phone already knows how to use. */
export function SelectField({
  label,
  hint,
  options,
  value,
  onValueChange,
  className,
  ...selectProps
}: SelectFieldProps) {
  const selectId = useId();
  const hintId = useId();
  return (
    <div className={classNames("flex flex-col gap-1.5", className)}>
      <label htmlFor={selectId} className="text-footnote font-medium text-label">
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          value={value}
          aria-describedby={hint ? hintId : undefined}
          onChange={(event) => onValueChange(event.target.value)}
          className={classNames("h-10 appearance-none pe-9", controlClasses())}
          {...selectProps}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronsUpDown
          aria-hidden="true"
          strokeWidth={2}
          className="pointer-events-none absolute top-1/2 inset-e-3 size-4 -translate-y-1/2 text-label-secondary"
        />
      </div>
      {hint && (
        <p id={hintId} className="text-footnote text-label-secondary">
          {hint}
        </p>
      )}
    </div>
  );
}
