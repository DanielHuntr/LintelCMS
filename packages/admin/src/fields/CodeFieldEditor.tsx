import type { KeyboardEvent } from "react";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { t } from "../i18n/strings.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { textValue } from "./fieldValues.js";

const INDENT = "  ";

/**
 * Code, kept exactly as typed, in a monospaced box. Tab indents rather than leaving the box;
 * Escape then Tab leaves it, so keyboard users are never trapped.
 */
export function CodeFieldEditor({
  field,
  value,
  onChange,
  controlId,
  describedBy,
  hasError,
}: FieldEditorProps) {
  const code = textValue(value);
  const language = field.options.language ?? "plain";

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const box = event.currentTarget;
    if (event.key === "Escape") {
      box.dataset.tabLeaves = "true";
      return;
    }
    if (event.key !== "Tab" || event.shiftKey || box.dataset.tabLeaves === "true") {
      delete box.dataset.tabLeaves;
      return;
    }
    event.preventDefault();
    const { selectionStart, selectionEnd } = box;
    const next = code.slice(0, selectionStart) + INDENT + code.slice(selectionEnd);
    onChange(next);
    requestAnimationFrame(() => {
      box.selectionStart = box.selectionEnd = selectionStart + INDENT.length;
    });
  }

  return (
    <div className="relative">
      <textarea
        id={controlId}
        value={code}
        rows={8}
        placeholder={field.placeholder}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        maxLength={field.options.maxLength}
        onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
        onKeyDown={handleKeyDown}
        aria-required={field.required || undefined}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        className={classNames(
          "min-h-32 resize-y py-2.5 font-mono text-footnote leading-relaxed",
          controlClasses({ hasError }),
        )}
      />
      {language !== "plain" && (
        <span
          aria-label={t("fields.code.language", { language })}
          className="pointer-events-none absolute top-2 inset-e-3 rounded-full bg-fill px-2 py-0.5 font-mono text-caption text-label-secondary"
        >
          {language}
        </span>
      )}
    </div>
  );
}
