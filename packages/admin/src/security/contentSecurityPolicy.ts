/**
 * The admin's Content-Security-Policy. The admin holds an editor's session, so a script
 * that got into it (through a bug in how some content is shown) could do anything the editor
 * can. The policy keeps such a script from running at all: only the admin's own files run,
 * and the page talks only to itself and the API.
 *
 *   - images may also come from the API (the media library) and be data: or blob: URLs;
 *   - live preview frames the website's own pages, which can be anywhere;
 *   - inline styles are allowed, because React sets `style` attributes for layout.
 *
 * `frame-ancestors` (who may put the admin in a frame) only works as an HTTP header, so
 * `securityHeaders` gives the full set for whatever serves the built files.
 */
export function contentSecurityPolicy(apiUrl: string, { forHeader = false } = {}): string {
  const api = new URL(apiUrl).origin;
  const directives = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${api}`,
    "font-src 'self' data:",
    `connect-src 'self' ${api}`,
    "frame-src 'self' https: http:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(forHeader ? ["frame-ancestors 'none'"] : []),
  ];
  return directives.join("; ");
}

/** Headers to send with the admin's files, for `vite preview` and for any web server. */
export function securityHeaders(apiUrl: string): Record<string, string> {
  return {
    "Content-Security-Policy": contentSecurityPolicy(apiUrl, { forHeader: true }),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
}
