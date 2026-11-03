import { getSchema, type JSONContent } from "@tiptap/core";
import { generateHTML } from "@tiptap/html";
import { Node } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import { renderResponsiveImageHtml } from "@lintel/site-components/server";
import { readPageLinkId } from "@lintel/builder-model";
import type { DeliveredAsset } from "./image-assets.js";
import {
  findPictureProblem,
  type PictureAlignment,
  RICH_TEXT_PICTURE_NODE,
  RichTextPicture,
} from "./rich-text-picture.js";

/**
 * Rich text is stored as the editor's own JSON (a TipTap/ProseMirror document), which
 * keeps structure that HTML would lose. These helpers use the same StarterKit extensions
 * as the admin's editor, and the same picture node (rich-text-picture.ts), so "valid"
 * means "the editor can open it".
 */
const extensions = [StarterKit, RichTextPicture];
const editorSchema = getSchema(extensions);

/**
 * For drawing HTML: a picture is written as an empty placeholder, which
 * renderRichTextHtml swaps for the finished `<figure>`. Text is escaped on the way out, so
 * nothing typed can pass for a placeholder.
 */
const PICTURE_PLACEHOLDER = "<lintel-picture></lintel-picture>";
const htmlExtensions = [
  StarterKit,
  RichTextPicture.extend({ renderHTML: () => ["lintel-picture"] }),
];

export type RichTextDocument = JSONContent & { type: "doc" };

/** True when the document only uses nodes and marks the editor knows about. */
export function isReadableRichText(document: RichTextDocument): boolean {
  try {
    Node.fromJSON(editorSchema, document).check();
    return true;
  } catch {
    return false;
  }
}

/**
 * How deep rich text may nest (quotes inside quotes, lists inside lists). Real writing stays
 * well inside this; 2,000 nested quotes saved, then broke the entry with a stack overflow
 * when it was opened (LINTEL-FUNC-009).
 */
export const MAX_RICH_TEXT_DEPTH = 50;

/**
 * True when no node is nested deeper than the limit. It walks without recursion, so the check
 * can't overflow either.
 */
export function isShallowEnoughRichText(document: RichTextDocument): boolean {
  const waiting: Array<{ node: JSONContent; depth: number }> = [{ node: document, depth: 0 }];
  while (waiting.length > 0) {
    const { node, depth } = waiting.pop()!;
    if (depth > MAX_RICH_TEXT_DEPTH) return false;
    for (const child of node.content ?? []) waiting.push({ node: child, depth: depth + 1 });
  }
  return true;
}

/** True when there is nothing in the document but empty paragraphs. */
export function isEmptyRichText(document: RichTextDocument): boolean {
  return (document.content ?? []).every(
    (node) => node.type === "paragraph" && (node.content ?? []).length === 0,
  );
}

/** The document's pictures, in reading order (the order HTML is written in). */
function picturesIn(document: JSONContent): JSONContent[] {
  const found: JSONContent[] = [];
  const waiting: JSONContent[] = [document];
  while (waiting.length > 0) {
    const node = waiting.shift()!;
    if (node.type === RICH_TEXT_PICTURE_NODE) found.push(node);
    waiting.unshift(...(node.content ?? []));
  }
  return found;
}

/** Why the document's pictures can't be saved, or null when they're all fine. */
export function findRichTextPictureProblem(document: RichTextDocument): string | null {
  for (const picture of picturesIn(document)) {
    const problem = findPictureProblem(picture.attrs);
    if (problem) return problem;
  }
  return null;
}

/** The media library images the document's pictures show, once each. */
export function richTextAssetIds(document: RichTextDocument): string[] {
  const ids = picturesIn(document).flatMap((picture) =>
    typeof picture.attrs?.assetId === "string" ? [picture.attrs.assetId] : [],
  );
  return [...new Set(ids)];
}

/** What drawing rich text needs from the rest of Lintel: pages' addresses and pictures. */
export interface RichTextLookups {
  /** A linked page's address now, or null when it is gone or not live. */
  pageAddress: (entryId: string) => string | null;
  /** A picture's image, or null when it has left the media library. */
  picture: (assetId: string) => DeliveredAsset | null;
}

/** With nothing to look up: links to pages become plain words and pictures are left out. */
export const noRichTextLookups: RichTextLookups = {
  pageAddress: () => null,
  picture: () => null,
};

/**
 * The document as websites receive it. Links to pages (`lintel:page/<id>`) get the page's
 * address, with `entryId` kept beside it; a link to a page that is gone loses its link and
 * stays as plain words. Each picture gets its `image` (url, size, focal point) or null.
 * The stored document is left alone.
 */
export function resolveRichText(
  document: RichTextDocument,
  lookups: RichTextLookups,
): RichTextDocument {
  return resolveNode(document, lookups) as RichTextDocument;
}

function resolveNode(node: JSONContent, lookups: RichTextLookups): JSONContent {
  const resolved: JSONContent = { ...node };
  if (node.marks) {
    resolved.marks = node.marks.flatMap((mark) => {
      if (mark.type !== "link") return [mark];
      const entryId = readPageLinkId(mark.attrs?.href);
      if (!entryId) return [mark];
      const address = lookups.pageAddress(entryId);
      return address === null
        ? []
        : [{ ...mark, attrs: { ...mark.attrs, href: address, entryId } }];
    });
  }
  if (node.type === RICH_TEXT_PICTURE_NODE) {
    const assetId: unknown = node.attrs?.assetId;
    resolved.attrs = {
      ...node.attrs,
      image: typeof assetId === "string" ? lookups.picture(assetId) : null,
    };
  }
  if (node.content) resolved.content = node.content.map((child) => resolveNode(child, lookups));
  return resolved;
}

/**
 * HTML for sites that just want to print the content. Links with unsafe addresses (such
 * as `javascript:`) lose their address on the way; links to pages get the page's address
 * now (see resolveRichText); pictures become responsive `<figure>`s, and are left out when
 * their image has gone.
 */
export function renderRichTextHtml(
  document: RichTextDocument,
  lookups: RichTextLookups = noRichTextLookups,
): string {
  const resolved = resolveRichText(document, lookups);
  const figures = picturesIn(resolved).map((picture) => renderPictureHtml(picture.attrs));
  let index = 0;
  return generateHTML(resolved, htmlExtensions).replaceAll(
    PICTURE_PLACEHOLDER,
    () => figures[index++] ?? "",
  );
}

const pictureSizes: Record<PictureAlignment, string> = {
  full: "(max-width: 48rem) 100vw, 48rem",
  left: "(max-width: 40rem) 100vw, 20rem",
  right: "(max-width: 40rem) 100vw, 20rem",
};

/** `<figure class="lintel-picture lintel-picture--left"><img …><figcaption>…</figure>` */
function renderPictureHtml(attributes: Record<string, unknown> | undefined): string {
  const image = attributes?.image as DeliveredAsset | null | undefined;
  if (!image) return "";
  const align: PictureAlignment =
    attributes?.align === "left" || attributes?.align === "right" ? attributes.align : "full";
  const alt = typeof attributes?.alt === "string" ? attributes.alt : image.alt;
  const caption = typeof attributes?.caption === "string" ? attributes.caption.trim() : "";
  const picture = renderResponsiveImageHtml({
    image: { ...image, alt },
    sizes: pictureSizes[align],
  });
  const captionHtml = caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : "";
  return `<figure class="lintel-picture lintel-picture--${align}">${picture}${captionHtml}</figure>`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
