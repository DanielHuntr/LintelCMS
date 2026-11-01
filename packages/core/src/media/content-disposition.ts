/**
 * The Content-Disposition header for a file. Filenames are already cleaned on upload, but
 * may hold any Unicode, so the plain `filename` gets an ASCII-only version for old clients
 * and `filename*` carries the real name (RFC 6266).
 */
export function contentDisposition(disposition: "inline" | "attachment", filename: string): string {
  const asciiFallback = filename
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/["\\]/g, "")
    .trim();
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${disposition}; filename="${asciiFallback || "file"}"; filename*=UTF-8''${encoded}`;
}
