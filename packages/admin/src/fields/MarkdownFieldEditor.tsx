import MarkdownIt from "markdown-it";
import { type ClipboardEvent, type DragEvent, useState } from "react";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { t } from "../i18n/strings.js";
import { useRefreshAssetLists } from "../media/media.queries.js";
import { picturesFrom } from "../media/pastedFiles.js";
import { PictureUploadStatus } from "../media/PictureUploadStatus.js";
import { usePictureUpload } from "../media/usePictureUpload.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { textValue } from "./fieldValues.js";

// The same settings as the API's renderer: typed HTML is shown as text, never run.
const markdown = new MarkdownIt({ html: false, linkify: true, typographer: true });

type View = "write" | "preview";

/**
 * Markdown, written in a plain text box, with a preview of how it will look. A picture
 * dropped or pasted into the box is uploaded to the media library and written in as
 * `![](address)` where the cursor is, with a nudge to describe it between the brackets.
 */
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
  const quickUpload = usePictureUpload();
  const refreshLists = useRefreshAssetLists();

  async function insertPicture(files: File[], textarea: HTMLTextAreaElement) {
    const at = textarea.selectionStart;
    const uploaded = await quickUpload.uploadPicture(files, t("media.quickUpload.markdownDone"));
    if (!uploaded) return;
    void refreshLists();
    onChange(insertPictureMarkdown(textValue(textarea.value), at, uploaded.url));
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pictures = picturesFrom(event.clipboardData);
    if (pictures.length === 0) return;
    event.preventDefault();
    void insertPicture(pictures, event.currentTarget);
  }

  function handleDrop(event: DragEvent<HTMLTextAreaElement>) {
    const pictures = picturesFrom(event.dataTransfer);
    if (pictures.length === 0) return;
    event.preventDefault();
    void insertPicture(pictures, event.currentTarget);
  }

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
          onPaste={handlePaste}
          onDrop={handleDrop}
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
      <PictureUploadStatus status={quickUpload.status} onDismiss={quickUpload.clear} />
    </div>
  );
}

/** The text with a picture written in at `position`, on a line of its own. */
export function insertPictureMarkdown(text: string, position: number, url: string): string {
  const before = text.slice(0, position);
  const after = text.slice(position);
  return `${before}${lineBreaksBefore(before)}![](${url})${lineBreaksAfter(after)}${after}`;
}

/** Enough line breaks that what comes next starts a paragraph of its own. */
function lineBreaksBefore(text: string): string {
  if (text === "" || text.endsWith("\n\n")) return "";
  return text.endsWith("\n") ? "\n" : "\n\n";
}

function lineBreaksAfter(text: string): string {
  if (text === "" || text.startsWith("\n\n")) return "";
  return text.startsWith("\n") ? "\n" : "\n\n";
}
