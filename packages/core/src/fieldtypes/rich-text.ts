import { getSchema, type JSONContent } from "@tiptap/core";
import { generateHTML } from "@tiptap/html";
import { Node } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";

/**
 * Rich text is stored as the editor's own JSON (a TipTap/ProseMirror document), which
 * keeps structure that HTML would lose. These helpers use the same StarterKit extensions
 * as the admin's editor, so "valid" means "the editor can open it".
 */
const extensions = [StarterKit];
const editorSchema = getSchema(extensions);

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

/**
 * HTML for sites that just want to print the content. Links with unsafe addresses (such
 * as `javascript:`) lose their address on the way.
 */
export function renderRichTextHtml(document: RichTextDocument): string {
  return generateHTML(document, extensions);
}
