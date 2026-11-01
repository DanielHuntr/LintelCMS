/**
 * What visitors see when Lintel couldn't start on a shared host. Passenger would otherwise
 * show its own "Web application could not be started" page, which says nothing useful to
 * the person who installed Lintel. Problems Lintel can explain (a wrong setting, a folder
 * it can't write to) are shown as they are: they name settings and folders, never secrets.
 * Anything else only points to the log.
 */
export function startupProblemPage(explanation: string | undefined): string {
  const message = explanation
    ? `<p>${escapeHtml(explanation).replace(/\n/g, "<br />")}</p>`
    : "<p>Something unexpected went wrong while Lintel was starting. The details are in the " +
      "app's log: on cPanel hosting that is <code>stderr.log</code> in the application folder " +
      "(open it with File Manager).</p>";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Lintel couldn't start</title>
    <style>
      :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 2rem; }
      main { max-width: 38rem; line-height: 1.5; }
      h1 { font-size: 1.6rem; margin: 0 0 0.75rem; }
      code { font-size: 0.95em; }
    </style>
  </head>
  <body>
    <main>
      <h1>Lintel couldn't start</h1>
      ${message}
      <p>After fixing it, restart the app (in cPanel: Setup Node.js App, then Restart).</p>
    </main>
  </body>
</html>
`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
