import { findNode, type PageDocument, readPageFonts } from "@lintel/builder-model";
import type { TextSelectionMessage } from "../canvas/canvas-messages.js";
import { isLocked } from "../editor/commands.js";
import { readMarks } from "../editor/design-commands.js";
import { useBuilderText } from "../i18n/builder-text.js";
import { type MarkChange, TextStyleBar } from "./TextStyleBar.js";

/** The elements whose text can have styled parts. */
export const markableTypes: readonly string[] = ["heading", "text"];

/**
 * The words selected in a heading's or paragraph's text, when there are any and the element
 * isn't locked: what Mod+B, Mod+I and Mod+K act on.
 */
export function selectedWords(document: PageDocument, selection: TextSelectionMessage | null) {
  if (!selection || selection.nodeId === null || selection.prop !== "text") return null;
  const node = findNode(document.root, selection.nodeId);
  if (!node || !markableTypes.includes(node.type) || isLocked(document, node.id)) return null;
  const from = Math.min(selection.from, selection.to);
  const to = Math.max(selection.from, selection.to);
  if (to <= from) return null;
  return { selection, marks: readMarks(node), from, to };
}

/**
 * The bar above the canvas while words of a heading or paragraph are selected on it: what's
 * selected, and the styles that can go on it.
 */
export function SelectedWordsBar({
  document,
  selection,
  onApply,
  linkRequest,
}: {
  document: PageDocument;
  selection: TextSelectionMessage;
  onApply: (styles: MarkChange | null, label: string) => void;
  /** Goes up each time Mod+K asks for a link. */
  linkRequest?: number;
}) {
  const text = useBuilderText();
  const node = findNode(document.root, selection.nodeId);
  if (!node || !markableTypes.includes(node.type) || selection.prop !== "text") return null;
  const from = Math.min(selection.from, selection.to);
  const to = Math.max(selection.from, selection.to);
  const words = selection.text.slice(from, to);
  return (
    <div className="flex flex-wrap items-center gap-3 hairline-bottom bg-surface px-4 py-2">
      <span className="max-w-48 truncate text-caption text-label-secondary">
        {text("pageBuilder.inlineText.selected", { words })}
      </span>
      <TextStyleBar
        from={from}
        to={to}
        marks={readMarks(node)}
        pageFonts={readPageFonts(document.root.props)}
        disabled={isLocked(document, node.id)}
        onApply={onApply}
        linkRequest={linkRequest}
      />
    </div>
  );
}
