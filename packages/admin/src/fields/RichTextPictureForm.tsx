import {
  MAX_PICTURE_ALT_LENGTH,
  MAX_PICTURE_CAPTION_LENGTH,
  type PictureAlignment,
  type RichTextPictureAttributes,
} from "@lintel/core/rich-text-picture";
import { Selection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../design/Button.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { AltTextField } from "../media/AltTextField.js";

/** The picture the cursor is on: where it is in the document, and its settings. */
export interface SelectedPicture {
  position: number;
  attributes: RichTextPictureAttributes;
}

interface RichTextPictureFormProps {
  editor: Editor;
  picture: SelectedPicture;
  /** Put the cursor in the description straight away, as just after adding a picture. */
  focusDescription: boolean;
  onReplace: () => void;
}

/**
 * A selected picture's settings, under the toolbar where the link form opens: its
 * description (asked for first, as image fields ask for alt text), a caption, and whether it
 * sits across the text or beside it. Changes go straight into the document.
 */
export function RichTextPictureForm({
  editor,
  picture,
  focusDescription,
  onReplace,
}: RichTextPictureFormProps) {
  const [alt, setAlt] = useState(picture.attributes.alt);
  const [caption, setCaption] = useState(picture.attributes.caption);
  const form = useRef<HTMLElement>(null);

  // After a drop or a paste the editor takes focus back once it has put the picture in, so
  // the description is focused a moment later rather than when the form first appears.
  useEffect(() => {
    if (!focusDescription) return;
    const frame = requestAnimationFrame(() => form.current?.querySelector("textarea")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [focusDescription]);

  function change(changes: Partial<RichTextPictureAttributes>) {
    editor.chain().setNodeSelection(picture.position).updateAttributes("image", changes).run();
  }

  /** Back to writing, with the cursor just after the picture. */
  function finish() {
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        const after = picture.position + (tr.doc.nodeAt(picture.position)?.nodeSize ?? 1);
        tr.setSelection(Selection.near(tr.doc.resolve(Math.min(after, tr.doc.content.size))));
        return true;
      })
      .run();
  }

  return (
    <section
      ref={form}
      aria-label={t("fields.richText.picture.settings")}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          finish();
        }
      }}
      className="flex flex-col gap-3 px-3 py-3 hairline-bottom"
    >
      <AltTextField
        label={t("fields.richText.picture.alt")}
        hint={t("fields.richText.picture.altHint")}
        value={alt}
        maxLength={MAX_PICTURE_ALT_LENGTH}
        rows={2}
        onChange={(event) => {
          setAlt(event.target.value);
          change({ alt: event.target.value });
        }}
      />
      <TextField
        label={t("fields.richText.picture.caption")}
        placeholder={t("fields.richText.picture.captionPlaceholder")}
        value={caption}
        maxLength={MAX_PICTURE_CAPTION_LENGTH}
        onChange={(event) => {
          setCaption(event.target.value);
          change({ caption: event.target.value });
        }}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-footnote font-medium text-label" aria-hidden="true">
          {t("fields.richText.picture.position")}
        </span>
        <SegmentedControl<PictureAlignment>
          label={t("fields.richText.picture.position")}
          value={picture.attributes.align}
          onChange={(align) => change({ align })}
          options={[
            { value: "full", label: t("fields.richText.picture.full") },
            { value: "left", label: t("fields.richText.picture.left") },
            { value: "right", label: t("fields.richText.picture.right") },
          ]}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="tinted" size="small" onClick={onReplace}>
          {t("fields.richText.picture.replace")}
        </Button>
        <Button
          variant="plain"
          size="small"
          onClick={() =>
            editor.chain().focus().setNodeSelection(picture.position).deleteSelection().run()
          }
        >
          {t("fields.richText.picture.remove")}
        </Button>
        <Button variant="plain" size="small" className="ms-auto" onClick={finish}>
          {t("fields.richText.picture.done")}
        </Button>
      </div>
    </section>
  );
}
