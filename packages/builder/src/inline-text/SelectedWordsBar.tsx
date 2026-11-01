import { findNode, type PageDocument, readPageFonts } from "@lintel/builder-model";
import type { TextSelectionMessage } from "../canvas/canvas-messages.js";
import { readMarks } from "../editor/design-commands.js";
import { useBuilderText } from "../i18n/builder-text.js";
import { type MarkChange, TextStyleBar } from "./TextStyleBar.js";

/** The elements whose text can have styled parts. */
export const markableTypes: readonly string[] = ["heading", "text"];

/**
 * The bar above the canvas while words of a heading or paragraph are selected on it: what's
 * selected, and the styles that can go on it.
 */
export function SelectedWordsBar({
  document,
  selection,
  onApply,
}: {
  document: PageDocument;
  selection: TextSelectionMessage;
  onApply: (styles: MarkChange | null, label: string) => void;
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
        disabled={node.locked}
        onApply={onApply}
      />
    </div>
  );
}
