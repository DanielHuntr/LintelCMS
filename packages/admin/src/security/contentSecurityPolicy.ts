/**
 * The admin's Content-Security-Policy. The admin holds an editor's session, so a script
 * that got into it (through a bug in how some content is shown) could do anything the editor
 * can. The policy keeps such a script from running at all: only the admin's own files run,
 * and the page talks only to itself and the API.
 *
 *   - images may also come from the API (the media library) and be data: or blob: URLs;
 *   - blob: URLs may be fetched: a 3D model's pictures are unpacked into them as it loads;
 *   - live preview frames the website's own pages, which can be anywhere;
 *   - inline styles are allowed, because React sets `style` attributes for layout;
 *   - fonts may come from the API (a site's own fonts, on the builder's canvas), and
 *     Adobe Fonts' stylesheet and files may load, for sites that use an Adobe project;
 *   - WebAssembly may be compiled ('wasm-unsafe-eval'), so the canvas can preview a Rive
 *     animation with Rive's runtime. It allows WebAssembly only: `eval` stays refused.
 *
 * `frame-ancestors` (who may put the admin in a frame) only works as an HTTP header, so
 * `securityHeaders` gives the full set for whatever serves the built files.
 */
/** Adobe Fonts' stylesheet, and the one it imports to count page views, as Adobe requires. */
const adobeFonts = "https://use.typekit.net https://p.typekit.net";

export function contentSecurityPolicy(apiUrl: string, { forHeader = false } = {}): string {
  const api = new URL(apiUrl).origin;
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    `style-src 'self' 'unsafe-inline' ${adobeFonts}`,
    `img-src 'self' data: blob: ${api}`,
    `font-src 'self' data: ${api} https://use.typekit.net`,
    `connect-src 'self' ${api} blob:`,
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
