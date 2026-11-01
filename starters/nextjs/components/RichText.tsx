import type { RichText as RichTextValue } from "../lib/content-types";

/**
 * A rich text field. Lintel turns the editor's document into HTML on its server, using only
 * the formatting the editor offers (headings, lists, links, quotes...) and dropping unsafe
 * link addresses such as `javascript:`, so the HTML can go straight into the page.
 */
export function RichText({ value }: { value: RichTextValue | null }) {
  if (!value || value.html === "") return null;
  return <div className="prose" dangerouslySetInnerHTML={{ __html: value.html }} />;
}
