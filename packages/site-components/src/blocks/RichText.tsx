import { classNames } from "../class-names.js";

export interface RichTextProps {
  /** Finished HTML from Lintel's rich text editor (headings, lists, links, quotes, pictures). */
  html: string;
  field?: string;
  className?: string;
}

/**
 * Formatted writing, styled for reading. Output: `<div class="lintel-prose">` holding the
 * editor's HTML as it is. The HTML comes from Lintel, which builds it from the editor's
 * document and refuses unsafe links, so it is safe to insert.
 */
export function RichText({ html, field, className }: RichTextProps) {
  if (html.trim() === "") {
    return null;
  }
  return (
    <div
      className={classNames("lintel-prose", className)}
      data-lintel-field={field}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
