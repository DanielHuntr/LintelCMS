/**
 * Splits a WordPress post's content into pieces Lintel can hold: rich text, images and
 * "HTML blocks" for whatever has no rich text equivalent (galleries, embeds, columns,
 * shortcodes). Both kinds of WordPress content are handled:
 *
 * - Block editor (Gutenberg) content, made of `<!-- wp:paragraph -->...<!-- /wp:paragraph -->`
 *   comments around HTML. Each top-level block becomes one piece.
 * - Classic editor content: HTML where blank lines mean paragraphs (WordPress adds the
 *   `<p>` tags only when showing the page), with `[shortcodes]` mixed in.
 *
 * Nothing here downloads or looks anything up; see wordpress-rich-text.ts for turning the
 * pieces into a rich text document once images have been brought in.
 */
export type ContentPiece =
  | { kind: "rich"; html: string }
  | { kind: "image"; url: string; alt: string; caption: string }
  | { kind: "html"; html: string; reason: string };

/** Blocks whose HTML rich text can hold as it is. */
const richTextBlocks = new Set([
  "paragraph",
  "heading",
  "list",
  "list-item",
  "quote",
  "code",
  "preformatted",
  "separator",
  "freeform",
]);

const BLOCK_COMMENT = /<!--\s+(\/)?wp:([a-z0-9-]+(?:\/[a-z0-9-]+)?)(\s+\{[\s\S]*?\})?\s*(\/)?-->/g;

export function splitWordPressContent(content: string): ContentPiece[] {
  return /<!--\s+wp:/.test(content) ? splitBlocks(content) : splitClassic(content);
}

function splitBlocks(content: string): ContentPiece[] {
  const pieces: ContentPiece[] = [];
  let depth = 0;
  let openName = "";
  let innerStart = 0;
  let outsideStart = 0;

  for (const match of content.matchAll(BLOCK_COMMENT)) {
    const [whole, closing, name = "", , selfClosing] = match;
    const index = match.index;
    if (depth === 0 && !closing) {
      pieces.push(...splitClassic(content.slice(outsideStart, index)));
      if (selfClosing) {
        pieces.push({ kind: "html", html: "", reason: blockName(name) });
        outsideStart = index + whole.length;
        continue;
      }
      openName = name;
      innerStart = index + whole.length;
      depth = 1;
      continue;
    }
    if (selfClosing) {
      continue;
    }
    depth += closing ? -1 : 1;
    if (depth === 0) {
      pieces.push(...blockPieces(blockName(openName), content.slice(innerStart, index)));
      outsideStart = index + whole.length;
    }
  }
  pieces.push(...splitClassic(content.slice(outsideStart)));
  return pieces;
}

/** "core/paragraph" and "paragraph" are the same block. */
function blockName(name: string): string {
  return name.startsWith("core/") ? name.slice("core/".length) : name;
}

function blockPieces(name: string, innerHtml: string): ContentPiece[] {
  const html = innerHtml.replace(BLOCK_COMMENT, "").trim();
  if (name === "image") {
    const image = findImages(html)[0];
    return image ? [image] : [];
  }
  if (name === "freeform") {
    return splitClassic(html);
  }
  if (richTextBlocks.has(name)) {
    return splitOutImages(html);
  }
  return [{ kind: "html", html, reason: name }];
}

const SHORTCODE_LINE = /^\s*\[([a-z][a-z0-9_-]*)[^\]]*\](?:[\s\S]*?\[\/\1\])?\s*$/i;

function splitClassic(content: string): ContentPiece[] {
  if (content.trim() === "") {
    return [];
  }
  const pieces: ContentPiece[] = [];
  for (const paragraph of content.trim().split(/\n\s*\n/)) {
    const shortcode = SHORTCODE_LINE.exec(paragraph);
    if (shortcode) {
      pieces.push({ kind: "html", html: paragraph.trim(), reason: `[${shortcode[1]}] shortcode` });
      continue;
    }
    const html = /^\s*<(p|h[1-6]|ul|ol|blockquote|pre|table|div|figure|hr)\b/i.test(paragraph)
      ? paragraph
      : `<p>${paragraph.trim().replace(/\n/g, "<br>")}</p>`;
    pieces.push(...splitOutImages(html));
  }
  return pieces;
}

const IMAGE_TAG = /(?:<a\b[^>]*>\s*)?<img\b[^>]*>(?:\s*<\/a>)?/gi;

/** Pulls images out of a piece of HTML, keeping the text either side in order. */
function splitOutImages(html: string): ContentPiece[] {
  const pieces: ContentPiece[] = [];
  let start = 0;
  for (const match of html.matchAll(IMAGE_TAG)) {
    pushRich(pieces, html.slice(start, match.index));
    pieces.push(...findImages(match[0]));
    start = match.index + match[0].length;
  }
  pushRich(pieces, html.slice(start));
  return pieces;
}

function pushRich(pieces: ContentPiece[], html: string) {
  // What's left of a paragraph after taking an image out may be only its tags.
  if (html.replace(/<[^>]*>/g, "").trim() !== "" || /<hr\b/i.test(html)) {
    pieces.push({ kind: "rich", html });
  }
}

function findImages(html: string): ContentPiece[] {
  const caption = /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i.exec(html)?.[1] ?? "";
  return [...html.matchAll(/<img\b[^>]*>/gi)].flatMap((match) => {
    const url = attribute(match[0], "src");
    return url
      ? [
          {
            kind: "image" as const,
            url,
            alt: attribute(match[0], "alt"),
            caption: plainText(caption),
          },
        ]
      : [];
  });
}

function attribute(tag: string, name: string): string {
  const match = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag);
  return decodeEntities(match?.[2] ?? match?.[3] ?? "");
}

/** Text without tags, for excerpts and captions. */
export function plainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** WordPress escapes names and titles inside its CDATA; this undoes the usual entities. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_entity, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}
