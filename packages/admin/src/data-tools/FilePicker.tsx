import { useId } from "react";

interface FilePickerProps {
  label: string;
  hint?: string;
  accept: string;
  disabled?: boolean;
  onPick: (file: File) => void;
  /** Let several files be picked at once; each is passed to `onPickAll`. */
  multiple?: boolean;
  onPickAll?: (files: File[]) => void;
}

/** A labelled file input in the admin's style. Picking a file calls `onPick` straight away. */
export function FilePicker({
  label,
  hint,
  accept,
  disabled = false,
  onPick,
  multiple = false,
  onPickAll,
}: FilePickerProps) {
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
        multiple={multiple}
        aria-describedby={hint ? hintId : undefined}
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          if (files[0]) onPick(files[0]);
          onPickAll?.(files);
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
