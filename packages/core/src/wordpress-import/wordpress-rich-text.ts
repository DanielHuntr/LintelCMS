import type { JSONContent } from "@tiptap/core";
import { generateJSON } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import { isReadableRichText, type RichTextDocument } from "../fieldtypes/rich-text.js";
import type { ContentPiece } from "./wordpress-content.js";

/**
 * Turns content pieces into one rich text document, using the same editor extensions as
 * the admin so the result opens in the editor.
 *
 * Rich text in Lintel has no images or raw HTML, so those are kept as code blocks marked
 * `html`: nothing is lost, an editor can see and replace them, and a website that wants to
 * can print them as HTML. The import report lists every one.
 */
const extensions = [StarterKit];

/** Where an image ended up: its address in the media library, or null if it couldn't be brought in. */
export type ImageAddress = (url: string) => string | null;

export interface ConvertedRichText {
  document: RichTextDocument;
  /** Pieces kept as HTML, by why: a block name such as "embed", or "image". */
  keptAsHtml: string[];
}

export function piecesToRichText(
  pieces: readonly ContentPiece[],
  imageAddress: ImageAddress,
): ConvertedRichText {
  const content: JSONContent[] = [];
  const keptAsHtml: string[] = [];

  for (const piece of pieces) {
    if (piece.kind === "rich") {
      content.push(...htmlToNodes(piece.html));
    } else if (piece.kind === "image") {
      const address = imageAddress(piece.url) ?? piece.url;
      content.push(
        htmlBlock(`<img src="${escapeAttribute(address)}" alt="${escapeAttribute(piece.alt)}">`),
      );
      if (piece.caption) {
        content.push({ type: "paragraph", content: [{ type: "text", text: piece.caption }] });
      }
      keptAsHtml.push("image");
    } else {
      content.push(htmlBlock(piece.html || `<!-- ${piece.reason} -->`));
      keptAsHtml.push(piece.reason);
    }
  }

  const document: RichTextDocument = {
    type: "doc",
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  };
  // Should never happen, as the editor's own parser made the nodes; kept as a safety net.
  if (!isReadableRichText(document)) {
    return { document: { type: "doc", content: [{ type: "paragraph" }] }, keptAsHtml };
  }
  return { document, keptAsHtml };
}

function htmlToNodes(html: string): JSONContent[] {
  const parsed = generateJSON(html, extensions) as JSONContent;
  return (parsed.content ?? []).filter(
    (node) => node.type !== "paragraph" || (node.content ?? []).length > 0,
  );
}

function htmlBlock(html: string): JSONContent {
  return {
    type: "codeBlock",
    attrs: { language: "html" },
    content: [{ type: "text", text: html }],
  };
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
