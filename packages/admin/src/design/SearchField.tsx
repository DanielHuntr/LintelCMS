import { Search } from "lucide-react";
import { useId, type InputHTMLAttributes } from "react";
import { classNames } from "./classNames.js";
import { controlClasses } from "./controlStyles.js";

interface SearchFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "type" | "onChange" | "placeholder"
> {
  /** e.g. "Search posts". Shown as the placeholder and given to screen readers as the label. */
  label: string;
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * A search box with a magnifying glass, like Spotlight's. The label is the placeholder text,
 * the convention people know for search, and it stays the accessible name once they type.
 */
export function SearchField({
  label,
  value,
  onValueChange,
  className,
  ...inputProps
}: SearchFieldProps) {
  const inputId = useId();

  return (
    <div className={classNames("relative", className)}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden="true"
        strokeWidth={2}
        className="pointer-events-none absolute top-1/2 inset-s-2.5 size-4 -translate-y-1/2 text-label-tertiary"
      />
      <input
        id={inputId}
        type="search"
        value={value}
        placeholder={label}
        onChange={(event) => onValueChange(event.target.value)}
        className={classNames("h-9 ps-8", controlClasses())}
        {...inputProps}
      />
    </div>
  );
}
