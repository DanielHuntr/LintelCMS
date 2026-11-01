import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useState } from "react";
import { classNames } from "../design/classNames.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import type { RichTextDocument } from "./field.types.js";
import { richTextValue } from "./fieldValues.js";
import { richTextExtensions } from "./richTextExtensions.js";
import { RichTextLinkForm } from "./RichTextLinkForm.js";
import { RichTextToolbar } from "./RichTextToolbar.js";

/**
 * Formatted writing, edited with TipTap and stored as its JSON document. A quiet toolbar sits
 * above the text and sticks to the top while you scroll through a long article.
 */
export function RichTextFieldEditor({
  value,
  onChange,
  controlId,
  labelId,
  describedBy,
  hasError,
}: FieldEditorProps) {
  const [isLinkFormOpen, setIsLinkFormOpen] = useState(false);

  const editor = useEditor({
    extensions: richTextExtensions,
    content: richTextValue(value),
    onUpdate: ({ editor: updated }) => onChange(updated.getJSON() as RichTextDocument),
    editorProps: { attributes: editableAttributes(controlId, labelId, describedBy, hasError) },
  });

  // TipTap reads attributes once; keep them current as errors come and go.
  useEffect(() => {
    editor.setOptions({
      editorProps: { attributes: editableAttributes(controlId, labelId, describedBy, hasError) },
    });
  }, [editor, controlId, labelId, describedBy, hasError]);

  return (
    <div
      className={classNames(
        "rounded-card hairline-ring transition-shadow duration-150 ease-standard",
        "has-[.ProseMirror:focus]:focus-ring has-[.ProseMirror:focus]:outline-offset-0",
        hasError && "ring-1 ring-danger",
      )}
    >
      <RichTextToolbar
        editor={editor}
        controlId={controlId}
        isLinkFormOpen={isLinkFormOpen}
        onToggleLinkForm={() => setIsLinkFormOpen((wasOpen) => !wasOpen)}
      />
      {isLinkFormOpen && (
        <RichTextLinkForm editor={editor} onDone={() => setIsLinkFormOpen(false)} />
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

function editableAttributes(
  controlId: string,
  labelId: string,
  describedBy: string | undefined,
  hasError: boolean,
): Record<string, string> {
  const attributes: Record<string, string> = {
    id: controlId,
    role: "textbox",
    "aria-multiline": "true",
    "aria-labelledby": labelId,
    class: "rich-text min-h-40 px-4 pt-3 pb-4 outline-none",
  };
  if (describedBy) attributes["aria-describedby"] = describedBy;
  if (hasError) attributes["aria-invalid"] = "true";
  return attributes;
}
