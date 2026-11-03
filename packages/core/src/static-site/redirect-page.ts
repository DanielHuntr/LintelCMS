/**
 * A tiny page that sends visitors on, for hosts that don't read the generated server
 * settings: it redirects at once, tells search engines where the page lives now, and
 * shows a link for anyone whose browser doesn't follow.
 */
export function redirectPage(to: string): string {
  const target = to
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    "<title>This page has moved</title>",
    `<meta http-equiv="refresh" content="0; url=${target}">`,
    `<link rel="canonical" href="${target}">`,
    '<meta name="robots" content="noindex">',
    "</head>",
    `<body><p>This page has moved to <a href="${target}">${target}</a>.</p></body>`,
    "</html>",
    "",
  ].join("\n");
}
