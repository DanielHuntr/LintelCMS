import type { PictureAlignment } from "@lintel/core/rich-text-picture";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { ImageOff } from "lucide-react";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import { useAsset } from "../media/media.queries.js";

// Beside the text only when the text box is wide enough for words to flow round it, as the
// site does on wider screens (the editor's container, not the window, decides).
const alignmentClasses: Record<PictureAlignment, string> = {
  full: "w-full",
  left: "w-full @md:float-left @md:me-5 @md:mb-2 @md:w-[45%]",
  right: "w-full @md:float-right @md:ms-5 @md:mb-2 @md:w-[45%]",
};

/**
 * A picture as the editor shows it: the image, roughly where the site will put it, with its
 * caption under it. Clicking selects it, which opens its settings above the text (see
 * RichTextPictureForm). A picture with no description says so, as image fields do.
 */
export function RichTextPictureView({ node, selected }: ReactNodeViewProps) {
  const assetId = typeof node.attrs.assetId === "string" ? node.attrs.assetId : null;
  const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
  const caption = typeof node.attrs.caption === "string" ? node.attrs.caption : "";
  const align = (node.attrs.align as PictureAlignment | undefined) ?? "full";
  const asset = useAsset(assetId);
  const source = asset.data?.thumbnailUrl ?? asset.data?.url;

  return (
    <NodeViewWrapper
      as="figure"
      data-drag-handle=""
      className={classNames("my-3 flex flex-col gap-1.5", alignmentClasses[align])}
    >
      <div
        className={classNames(
          "overflow-hidden rounded-control bg-fill",
          selected && "outline-2 outline-offset-2 outline-accent",
        )}
      >
        {source ? (
          <img src={source} alt={alt} className="block h-auto w-full" draggable={false} />
        ) : (
          <span className="flex h-32 flex-col items-center justify-center gap-1 text-footnote text-label-secondary">
            {asset.isError && <ImageOff aria-hidden="true" className="size-6" />}
            {asset.isError
              ? t("fields.richText.picture.missing")
              : t("fields.richText.picture.loading")}
          </span>
        )}
      </div>
      {caption && <figcaption className="text-footnote text-label-secondary">{caption}</figcaption>}
      {alt.trim() === "" && (
        <p className="text-caption text-label-secondary">{t("fields.richText.picture.noAlt")}</p>
      )}
    </NodeViewWrapper>
  );
}
