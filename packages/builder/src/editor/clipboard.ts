import type { PageNode } from "@lintel/builder-model";

/**
 * Copying elements. The builder keeps what was copied itself (so a copy keeps every style and
 * setting), and also puts the element's HTML on the system clipboard so it can be pasted into
 * other apps. When something is pasted, the builder's own copy wins if the system clipboard
 * still holds what the builder put there, or if the builder couldn't write to it; otherwise
 * the system clipboard has something newer from another app, and its HTML is imported.
 */
export interface BuilderClipboard {
  nodes: PageNode[];
  /** What was written to the system clipboard, or null if writing wasn't allowed. */
  systemText: string | null;
}

export async function writeToSystemClipboard(html: string): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([html], { type: "text/plain" }),
        }),
      ]);
      return true;
    }
    await navigator.clipboard.writeText(html);
    return true;
  } catch {
    return false;
  }
}

export type PasteSource =
  { kind: "builder"; nodes: PageNode[] } | { kind: "html"; html: string } | { kind: "nothing" };

export function choosePasteSource(
  clipboard: BuilderClipboard | null,
  pasted: { html: string; text: string },
): PasteSource {
  const external = pasted.html.trim() || pasted.text.trim();
  const isOurs =
    clipboard !== null &&
    (clipboard.systemText === null ||
      pasted.text === clipboard.systemText ||
      pasted.html.includes(clipboard.systemText));
  if (clipboard && (isOurs || external === "")) return { kind: "builder", nodes: clipboard.nodes };
  if (pasted.html.trim()) return { kind: "html", html: pasted.html };
  if (pasted.text.trim()) return { kind: "html", html: escapePlainText(pasted.text) };
  return { kind: "nothing" };
}

/** Plain text becomes paragraphs, one per blank-line-separated block. */
function escapePlainText(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p>${paragraph.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
    )
    .join("");
}
