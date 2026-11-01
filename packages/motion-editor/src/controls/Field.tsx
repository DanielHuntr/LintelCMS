import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { classNames } from "./classNames.js";

/** The look of the studio's inputs and selects: a soft grey fill, as in the admin. */
export const controlClasses = classNames(
  "h-8 w-full rounded-control bg-fill px-2.5 text-footnote text-label",
  "placeholder:text-label-tertiary focus:focus-ring focus:outline-offset-0 disabled:opacity-50",
);

function Labelled({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-caption font-medium text-label-secondary">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-caption text-label-tertiary">
          {hint}
        </p>
      )}
    </div>
  );
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function TextInput({ label, hint, className, ...props }: TextInputProps) {
  const id = useId();
  return (
    <Labelled id={id} label={label} hint={hint}>
      <input
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={classNames(controlClasses, className)}
        {...props}
      />
    </Labelled>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}

export function Select({ label, hint, options, className, ...props }: SelectProps) {
  const id = useId();
  return (
    <Labelled id={id} label={label} hint={hint}>
      <select
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={classNames(controlClasses, className)}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Labelled>
  );
}

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Checkbox({ label, checked, onChange }: CheckboxProps) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-accent-fill focus-visible:focus-ring"
      />
      <label htmlFor={id} className="text-footnote text-label">
        {label}
      </label>
    </div>
  );
}
