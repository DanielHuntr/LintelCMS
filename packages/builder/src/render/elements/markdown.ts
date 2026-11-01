import { isSafeLinkAddress } from "@lintel/builder-model";

/**
 * The few bits of Markdown the Rich text element understands, turned into clean HTML:
 * `## headings` (levels 2 to 4), paragraphs, `- ` and `1. ` lists, `> quotes`, `**bold**`,
 * `*italics*` and `[links](/address)`. Everything is escaped first, so nothing typed can
 * become HTML of its own; links only keep safe addresses.
 */

function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(text: string): string {
  return escape(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\(([^\s()]+(?:\([^\s()]*\))?)\)/g,
      (_match, label: string, address: string) => {
        const href = address.replace(/&amp;/g, "&");
        return isSafeLinkAddress(href) ? `<a href="${escape(href)}">${label}</a>` : label;
      },
    )
    .replace(/\n/g, "<br>");
}

export function markdownToHtml(markdown: string): string {
  const blocks = markdown.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  return blocks
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const heading = /^(#{2,4})\s+(.+)$/.exec(block);
      if (heading?.[1] && heading[2] && !block.includes("\n")) {
        const level = heading[1].length;
        return `<h${level}>${inline(heading[2])}</h${level}>`;
      }
      const lines = block.split("\n");
      if (lines.every((line) => /^[-*]\s+/.test(line))) {
        return `<ul>${lines.map((line) => `<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      if (lines.every((line) => /^\d+[.)]\s+/.test(line))) {
        return `<ol>${lines.map((line) => `<li>${inline(line.replace(/^\d+[.)]\s+/, ""))}</li>`).join("")}</ol>`;
      }
      if (lines.every((line) => line.startsWith(">"))) {
        return `<blockquote><p>${inline(lines.map((line) => line.replace(/^>\s?/, "")).join("\n"))}</p></blockquote>`;
      }
      return `<p>${inline(block)}</p>`;
    })
    .join("");
}
