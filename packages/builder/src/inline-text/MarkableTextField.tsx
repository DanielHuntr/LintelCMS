import type { PageFont, TextMark } from "@lintel/builder-model";
import { useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { inputClassName, Labelled } from "../ui/controls.js";
import { type MarkChange, TextStyleBar } from "./TextStyleBar.js";

/**
 * A heading's or paragraph's text box in the Content panel, with the bar for styling part
 * of it: select words in the box (with the mouse, or Shift and the arrow keys), then press a
 * style. The same as selecting words on the canvas, for people who prefer the keyboard.
 */
export function MarkableTextField({
  label,
  value,
  marks,
  pageFonts,
  onChange,
  onMark,
}: {
  label: string;
  value: string;
  marks: readonly TextMark[];
  pageFonts: readonly PageFont[];
  onChange: (value: string) => void;
  onMark: (
    range: { from: number; to: number; text: string },
    styles: MarkChange | null,
    label: string,
  ) => void;
}) {
  const text = useBuilderText();
  const [selection, setSelection] = useState({ from: 0, to: 0 });
  const hasSelection = selection.to > selection.from;
  return (
    <div className="flex flex-col gap-2">
      <Labelled label={label}>
        {(id) => (
          <textarea
            id={id}
            value={value}
            rows={3}
            onChange={(event) => onChange(event.target.value)}
            onSelect={(event) =>
              setSelection({
                from: event.currentTarget.selectionStart,
                to: event.currentTarget.selectionEnd,
              })
            }
            className={`${inputClassName} h-auto resize-y py-1.5`}
          />
        )}
      </Labelled>
      <TextStyleBar
        from={selection.from}
        to={selection.to}
        marks={marks}
        pageFonts={pageFonts}
        disabled={!hasSelection}
        onApply={(styles, change) => onMark({ ...selection, text: value }, styles, change)}
      />
      <p className="text-caption text-label-tertiary">
        {text("pageBuilder.inlineText.contentHint")}
      </p>
    </div>
  );
}
