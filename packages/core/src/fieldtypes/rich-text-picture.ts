import { Node } from "@tiptap/core";

/**
 * A picture inside rich text: one image from the media library, with words describing it
 * for people who can't see it, an optional caption, and where it sits. It is stored as an
 * asset id, never an address, so the picture follows the media library and can be drawn in
 * every size the site needs.
 *
 * The admin's editor and core share this one definition (`@lintel/core/rich-text-picture`),
 * so "valid" still means "the editor can open it". It runs in the browser too: keep it free
 * of server code.
 */
export const RICH_TEXT_PICTURE_NODE = "image";

export const pictureAlignments = ["full", "left", "right"] as const;
export type PictureAlignment = (typeof pictureAlignments)[number];

export const MAX_PICTURE_ALT_LENGTH = 1000;
export const MAX_PICTURE_CAPTION_LENGTH = 500;

export interface RichTextPictureAttributes {
  assetId: string | null;
  alt: string;
  caption: string;
  align: PictureAlignment;
}

const assetIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Why a picture's settings can't be saved, in words an editor understands, or null when
 * they're fine. Checked here rather than by the schema, which accepts any attribute value.
 */
export function findPictureProblem(attributes: Record<string, unknown> | undefined): string | null {
  const { assetId, alt = "", caption = "", align = "full" } = attributes ?? {};
  if (typeof assetId !== "string" || !assetIdPattern.test(assetId)) {
    return "Each picture needs an image from the media library";
  }
  if (typeof alt !== "string" || alt.length > MAX_PICTURE_ALT_LENGTH) {
    return `A picture's description can be at most ${MAX_PICTURE_ALT_LENGTH} characters`;
  }
  if (typeof caption !== "string" || caption.length > MAX_PICTURE_CAPTION_LENGTH) {
    return `A picture's caption can be at most ${MAX_PICTURE_CAPTION_LENGTH} characters`;
  }
  if (!pictureAlignments.includes(align as PictureAlignment)) {
    return "A picture can be full width, or on the left or right of the text";
  }
  return null;
}

/** An alignment read from pasted HTML; anything unknown is full width. */
function readAlignment(value: string | null): PictureAlignment {
  return pictureAlignments.includes(value as PictureAlignment)
    ? (value as PictureAlignment)
    : "full";
}

/**
 * The node itself. Its HTML form, `<lintel-picture data-asset-id …>`, is only for copying
 * and pasting between editors: websites get proper `<figure><img>` markup from core.
 */
export const RichTextPicture = Node.create({
  name: RICH_TEXT_PICTURE_NODE,
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      assetId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-asset-id"),
        renderHTML: (attributes) => ({ "data-asset-id": attributes.assetId as string | null }),
      },
      alt: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-alt") ?? "",
        renderHTML: (attributes) => ({ "data-alt": attributes.alt as string }),
      },
      caption: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-caption") ?? "",
        renderHTML: (attributes) => ({ "data-caption": attributes.caption as string }),
      },
      align: {
        default: "full",
        parseHTML: (element) => readAlignment(element.getAttribute("data-align")),
        renderHTML: (attributes) => ({ "data-align": attributes.align as string }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "lintel-picture[data-asset-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["lintel-picture", HTMLAttributes];
  },
});
