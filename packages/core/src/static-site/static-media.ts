/**
 * Pictures on exported pages. The live site links to Lintel's media server, which resizes
 * on request (`/media/<id>/file?w=768&format=webp`). An exported site can't ask anyone, so
 * every copy a page links to is made now, saved under `media/`, and the page's links are
 * pointed at the saved files. A copy's name holds the picture's version, so a changed
 * picture gets a new name and an unchanged one is never made twice.
 */

export interface MediaReference {
  /** The address as written in the page, with `&amp;` as HTML has it. */
  written: string;
  /** Where the file is fetched from, relative to the API (`/media/<id>/file?...`). */
  requestPath: string;
  /** Where it is saved in the export, without an extension until its type is known. */
  fileStem: string;
}

const MEDIA_ID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Every media address in a page that points at this Lintel's media server. */
export function findMediaReferences(html: string, publicApiUrl: string): MediaReference[] {
  const base = publicApiUrl.replace(/\/+$/, "");
  const pattern = new RegExp(
    `${escapeRegExp(base)}/media/(${MEDIA_ID})/file(\\?[^"'\\s),<>]*)?`,
    "g",
  );
  const references = new Map<string, MediaReference>();
  for (const match of html.matchAll(pattern)) {
    const [written, id = "", query = ""] = match;
    if (references.has(written)) continue;
    const parameters = new URLSearchParams(query.replace(/&amp;/g, "&").replace(/^\?/, ""));
    references.set(written, {
      written,
      requestPath: `/media/${id}/file${query ? `?${parameters.toString()}` : ""}`,
      fileStem: `media/${id}/${fileStemFor(parameters)}`,
    });
  }
  return [...references.values()];
}

function fileStemFor(parameters: URLSearchParams): string {
  const version = (parameters.get("v") ?? "original").replace(/[^a-zA-Z0-9_-]/g, "");
  const width = parameters.get("w");
  const height = parameters.get("h");
  if (!width && !height) return version;
  const fit = parameters.get("fit") ?? "cover";
  return `${version}-${width ?? "auto"}x${height ?? "auto"}-${fit.replace(/[^a-z]/g, "")}`;
}

const extensions: Record<string, string> = {
  "image/webp": "webp",
  "image/avif": "avif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
};

export function extensionFor(contentType: string): string {
  return extensions[contentType.split(";")[0]?.trim().toLowerCase() ?? ""] ?? "bin";
}

/**
 * The page with every media address replaced by the saved file's address: site-relative
 * in the page, and in full (with the site's address) in `<meta content>`, where social
 * networks need it.
 */
export function rewriteMediaReferences(
  html: string,
  savedFiles: ReadonlyMap<string, string>,
  siteAddress: string | null,
): string {
  let rewritten = html;
  // Longest first, so an address isn't replaced inside a longer one.
  const written = [...savedFiles.keys()].sort((first, second) => second.length - first.length);
  for (const address of written) {
    const local = `/${savedFiles.get(address) ?? ""}`;
    rewritten = rewritten
      .split(`content="${address}"`)
      .join(`content="${siteAddress ?? ""}${local}"`)
      .split(address)
      .join(local);
  }
  return rewritten;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
