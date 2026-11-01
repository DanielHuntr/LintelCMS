import { useId } from "react";
import { classNames } from "./classNames.js";

interface ToggleProps {
  /** What the toggle turns on or off, e.g. "Email me when an order arrives". */
  label: string;
  /**
   * "hidden" when the same words are already visible next to the toggle,
   * as in a GroupedListRow. The label is then given to screen readers only.
   */
  labelVisibility?: "visible" | "hidden";
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Set when a label elsewhere on the page points at this switch with `htmlFor`. */
  id?: string;
  /** Ids of help or error text that describe the switch. */
  describedBy?: string;
}

/** An on/off switch. It is a button with role="switch", so Space and Enter work by default. */
export function Toggle({
  label,
  labelVisibility = "visible",
  checked,
  onCheckedChange,
  disabled = false,
  id,
  describedBy,
}: ToggleProps) {
  const generatedId = useId();
  const switchId = id ?? generatedId;
  const showLabel = labelVisibility === "visible";

  const control = (
    <button
      id={switchId}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={showLabel ? undefined : label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={classNames(
        "relative inline-flex h-[26px] w-[44px] shrink-0 items-center rounded-full p-0.5",
        "transition-colors duration-200 ease-standard focus-visible:focus-ring",
        "disabled:opacity-40",
        checked ? "bg-accent-fill" : "bg-fill-strong",
      )}
    >
      <span
        aria-hidden="true"
        className={classNames(
          "size-[22px] rounded-full bg-knob shadow-thumb",
          "transition-transform duration-200 ease-standard",
          checked ? "translate-x-[18px]" : "translate-x-0",
        )}
      />
    </button>
  );

  if (!showLabel) {
    return control;
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={switchId} className="text-body text-label">
        {label}
      </label>
      {control}
    </div>
  );
}
