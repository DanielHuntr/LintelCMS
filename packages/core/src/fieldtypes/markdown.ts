import MarkdownIt from "markdown-it";

/**
 * Markdown is stored as the text the editor typed, and rendered to HTML for the delivery
 * API. HTML typed into the text is shown as text rather than run (`html: false`), and
 * markdown-it refuses `javascript:` and similar link addresses, so the HTML is safe to print.
 */
const markdown = new MarkdownIt({ html: false, linkify: true, typographer: true });

export function renderMarkdownHtml(text: string): string {
  return markdown.render(text);
}
