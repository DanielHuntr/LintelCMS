/**
 * A small, self-contained HTML page for people whose browser posted a form without
 * JavaScript: the thank-you message, or what needs fixing, with a link back.
 */
export function plainPage(title: string, lines: readonly string[], back: string | null): string {
  const paragraphs = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("\n");
  const link = back ? `<p><a href="${escapeHtml(back)}">Go back</a></p>` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 1.0625rem/1.5 system-ui, sans-serif; max-width: 36rem; margin: 4rem auto; padding: 0 1.25rem; }
  a { color: #6a2cf0; }
  @media (prefers-color-scheme: dark) { a { color: #a68aff; } }
</style>
</head>
<body>
<main>
<h1>${escapeHtml(title)}</h1>
${paragraphs}
${link}
</main>
</body>
</html>
`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
