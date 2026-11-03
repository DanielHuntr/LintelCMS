import type { RichTextPictureAttributes } from "@lintel/core/rich-text-picture";
import { useQueryClient } from "@tanstack/react-query";
import { NodeSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { type Editor, EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import { type Asset, getAsset } from "../media/media.api.js";
import { mediaKeys, useRefreshAssetLists } from "../media/media.queries.js";
import { MediaPickerDialog } from "../media/MediaPickerDialog.js";
import { picturesFrom } from "../media/pastedFiles.js";
import { PictureUploadStatus } from "../media/PictureUploadStatus.js";
import { usePictureUpload } from "../media/usePictureUpload.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import type { RichTextDocument } from "./field.types.js";
import { richTextValue } from "./fieldValues.js";
import { richTextExtensions } from "./richTextExtensions.js";
import { RichTextLinkForm } from "./RichTextLinkForm.js";
import { RichTextPictureForm, type SelectedPicture } from "./RichTextPictureForm.js";
import { RichTextToolbar } from "./RichTextToolbar.js";

/** Choosing from the library: a new picture, or a new image for the selected one. */
type PictureChoice = { kind: "add" } | { kind: "replace"; position: number };

/**
 * Formatted writing, edited with TipTap and stored as its JSON document. A quiet toolbar sits
 * above the text and sticks to the top while you scroll through a long article.
 *
 * Pictures come from the media library: "Add picture" opens the image picker, and a picture
 * pasted or dropped into the text is uploaded and put where it landed. Each new picture opens
 * its settings with the description first, as image fields ask for alt text.
 */
export function RichTextFieldEditor({
  field,
  value,
  onChange,
  controlId,
  labelId,
  describedBy,
  hasError,
}: FieldEditorProps) {
  const [isLinkFormOpen, setIsLinkFormOpen] = useState(false);
  const [pictureChoice, setPictureChoice] = useState<PictureChoice | null>(null);
  const [newPicturePosition, setNewPicturePosition] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const refreshLists = useRefreshAssetLists();
  const quickUpload = usePictureUpload();
  // The editor's paste and drop handlers are made once; they reach the current editor here.
  const editorRef = useRef<Editor | null>(null);

  /** Puts a picture at `position` (the cursor when left out) and selects it. */
  function insertPicture(asset: Pick<Asset, "id" | "alt">, position?: number) {
    const current = editorRef.current;
    if (!current) return;
    const attributes: RichTextPictureAttributes = {
      assetId: asset.id,
      alt: asset.alt,
      caption: "",
      align: "full",
    };
    const at = position ?? current.state.selection.from;
    current.chain().focus().insertContentAt(at, { type: "image", attrs: attributes }).run();
    const placed = findPicture(current, asset.id, at);
    if (placed !== null) {
      current.commands.setNodeSelection(placed);
      setNewPicturePosition(placed);
    }
  }

  const insertPictureRef = useRef(insertPicture);
  const uploadPictureRef = useRef(quickUpload.uploadPicture);
  useEffect(() => {
    insertPictureRef.current = insertPicture;
    uploadPictureRef.current = quickUpload.uploadPicture;
  });

  const pictureHandlers = useMemo(() => {
    async function uploadAndInsert(files: File[], position?: number) {
      const asset = await uploadPictureRef.current(files, t("fields.richText.picture.uploaded"));
      if (!asset) return;
      void refreshLists();
      insertPictureRef.current(asset, position);
    }
    return {
      handlePaste: (_view: EditorView, event: ClipboardEvent) => {
        const pictures = picturesFrom(event.clipboardData);
        if (pictures.length === 0) return false;
        void uploadAndInsert(pictures);
        return true;
      },
      handleDrop: (view: EditorView, event: DragEvent, _slice: unknown, moved: boolean) => {
        // A picture dragged within the text is only moving: TipTap handles that.
        if (moved) return false;
        const pictures = picturesFrom(event.dataTransfer);
        if (pictures.length === 0) return false;
        event.preventDefault();
        const dropped = view.posAtCoords({ left: event.clientX, top: event.clientY });
        void uploadAndInsert(pictures, dropped?.pos);
        return true;
      },
    };
  }, [refreshLists]);

  const editor = useEditor({
    extensions: richTextExtensions,
    content: richTextValue(value),
    onUpdate: ({ editor: updated }) => onChange(updated.getJSON() as RichTextDocument),
    editorProps: {
      attributes: editableAttributes(controlId, labelId, describedBy, hasError),
      ...pictureHandlers,
    },
  });
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // TipTap reads attributes once; keep them current as errors come and go.
  useEffect(() => {
    editor.setOptions({
      editorProps: {
        attributes: editableAttributes(controlId, labelId, describedBy, hasError),
        ...pictureHandlers,
      },
    });
  }, [editor, controlId, labelId, describedBy, hasError, pictureHandlers]);

  const selectedPicture = useEditorState({
    editor,
    selector: ({ editor: current }) => readSelectedPicture(current),
    equalityFn: (before, after) => JSON.stringify(before) === JSON.stringify(after),
  });

  async function choosePicture(assetId: string) {
    const choice = pictureChoice;
    setPictureChoice(null);
    if (!choice) return;
    if (choice.kind === "replace") {
      editor
        .chain()
        .focus()
        .setNodeSelection(choice.position)
        .updateAttributes("image", { assetId })
        .run();
      return;
    }
    const asset = await queryClient
      .fetchQuery({ queryKey: mediaKeys.asset(assetId), queryFn: () => getAsset(assetId) })
      .catch(() => ({ id: assetId, alt: "" }));
    insertPicture(asset);
  }

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
        onAddPicture={() => setPictureChoice({ kind: "add" })}
      />
      {isLinkFormOpen && (
        <RichTextLinkForm editor={editor} onDone={() => setIsLinkFormOpen(false)} />
      )}
      {selectedPicture && !isLinkFormOpen && (
        <RichTextPictureForm
          // A different picture starts with its own words.
          key={`${selectedPicture.position}-${selectedPicture.attributes.assetId}`}
          editor={editor}
          picture={selectedPicture}
          focusDescription={newPicturePosition === selectedPicture.position}
          onReplace={() =>
            setPictureChoice({ kind: "replace", position: selectedPicture.position })
          }
        />
      )}
      <EditorContent editor={editor} />
      {quickUpload.status.state !== "idle" && (
        <div className="px-4 pb-2">
          <PictureUploadStatus status={quickUpload.status} onDismiss={quickUpload.clear} />
        </div>
      )}
      {pictureChoice && (
        <MediaPickerDialog
          fieldLabel={field.label}
          currentAssetId={
            pictureChoice.kind === "replace" ? (selectedPicture?.attributes.assetId ?? null) : null
          }
          onChoose={(assetId) => void choosePicture(assetId)}
          onClose={() => setPictureChoice(null)}
        />
      )}
    </div>
  );
}

/** The picture the selection is on, if it is on one. */
function readSelectedPicture(editor: Editor): SelectedPicture | null {
  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection) || selection.node.type.name !== "image") return null;
  return {
    position: selection.from,
    attributes: selection.node.attrs as RichTextPictureAttributes,
  };
}

/** Where the picture of `assetId` just put in near `around` ended up. */
function findPicture(editor: Editor, assetId: string, around: number): number | null {
  let closest: number | null = null;
  editor.state.doc.descendants((node, position) => {
    if (node.type.name !== "image" || node.attrs.assetId !== assetId) return;
    if (closest === null || Math.abs(position - around) < Math.abs(closest - around)) {
      closest = position;
    }
  });
  return closest;
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
    class: "rich-text @container min-h-40 px-4 pt-3 pb-4 outline-none",
  };
  if (describedBy) attributes["aria-describedby"] = describedBy;
  if (hasError) attributes["aria-invalid"] = "true";
  return attributes;
}
