import { useId, type KeyboardEvent } from "react";
import { classNames } from "../design/classNames.js";
import { titleFieldHandle } from "../fields/field.types.js";

interface EntryTitleInputProps {
  /** The blueprint's label for the title field, e.g. "Title" or "Name". */
  label: string;
  value: string;
  onChange: (title: string) => void;
  error: string | undefined;
  /** What Return does, such as opening a new page in the builder. Otherwise nothing. */
  onSubmit?: () => void;
}

/**
 * The entry's title as the heading of the document: large, borderless and wrapping onto
 * more lines when it's long, as in Pages or Notion. It's a text area for the wrapping, but
 * Enter doesn't add a line, since titles are a single line of text.
 */
export function EntryTitleInput({ label, value, onChange, error, onSubmit }: EntryTitleInputProps) {
  const inputId = useId();
  const errorId = useId();

  function preventNewLine(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (value.trim() !== "" && !event.nativeEvent.isComposing) onSubmit?.();
  }

  return (
    <div data-field-handle={titleFieldHandle} className="flex flex-col gap-1">
      {/* The placeholder shows the same words, so the visible cue is there until they type. */}
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <textarea
        id={inputId}
        rows={1}
        value={value}
        placeholder={label}
        onChange={(event) => onChange(event.target.value.replace(/\n/g, " "))}
        onKeyDown={preventNewLine}
        aria-required="true"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={classNames(
          "w-full resize-none bg-transparent text-large-title text-label [field-sizing:content]",
          "placeholder:text-label-tertiary/70 focus:outline-none",
          // A soft tint shows where focus is without boxing in the heading.
          "-mx-2 rounded-control px-2 py-0.5 transition-colors duration-150 ease-standard focus:bg-fill/50",
        )}
      />
      {error && (
        <p id={errorId} className="text-footnote font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
