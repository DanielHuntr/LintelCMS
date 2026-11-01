import { useId } from "react";

interface FilePickerProps {
  label: string;
  hint?: string;
  accept: string;
  disabled?: boolean;
  onPick: (file: File) => void;
}

/** A labelled file input in the admin's style. Picking a file calls `onPick` straight away. */
export function FilePicker({ label, hint, accept, disabled = false, onPick }: FilePickerProps) {
  const inputId = useId();
  const hintId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-footnote font-medium text-label">
        {label}
      </label>
      <input
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onPick(file);
        }}
        className="text-footnote text-label file:me-3 file:rounded-control file:border-0 file:bg-accent/12 file:px-3 file:py-1.5 file:font-medium file:text-accent disabled:opacity-50"
      />
      {hint && (
        <p id={hintId} className="text-footnote text-label-secondary">
          {hint}
        </p>
      )}
    </div>
  );
}
