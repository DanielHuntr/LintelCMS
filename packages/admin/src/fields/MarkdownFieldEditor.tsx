import MarkdownIt from "markdown-it";
import { useState } from "react";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { t } from "../i18n/strings.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { textValue } from "./fieldValues.js";

// The same settings as the API's renderer: typed HTML is shown as text, never run.
const markdown = new MarkdownIt({ html: false, linkify: true, typographer: true });

type View = "write" | "preview";

/** Markdown, written in a plain text box, with a preview of how it will look. */
export function MarkdownFieldEditor({
  field,
  value,
  onChange,
  controlId,
  describedBy,
  hasError,
}: FieldEditorProps) {
  const [view, setView] = useState<View>("write");
  const text = textValue(value);

  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl<View>
        label={t("fields.markdown.view", { label: field.label })}
        options={[
          { value: "write", label: t("fields.markdown.write") },
          { value: "preview", label: t("fields.markdown.preview") },
        ]}
        value={view}
        onChange={setView}
      />
      {view === "write" ? (
        <textarea
          id={controlId}
          value={text}
          rows={6}
          maxLength={field.options.maxLength}
          onChange={(event) => onChange(event.target.value)}
          aria-required={field.required || undefined}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          spellCheck
          className={classNames(
            "min-h-32 resize-y py-2 font-mono text-footnote [field-sizing:content]",
            controlClasses({ hasError }),
          )}
        />
      ) : (
        <div
          id={controlId}
          tabIndex={0}
          aria-label={t("fields.markdown.previewOf", { label: field.label })}
          className="rich-text min-h-32 rounded-control bg-fill/50 px-3 py-2 focus-visible:focus-ring"
          // markdown-it escapes any HTML in the text (html: false), so this is safe to insert.
          dangerouslySetInnerHTML={{
            __html: text.trim() ? markdown.render(text) : `<p>${t("fields.markdown.nothing")}</p>`,
          }}
        />
      )}
    </div>
  );
}
