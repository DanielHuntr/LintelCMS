/**
 * Which admin requests change the content model, for two jobs: refusing them while schema
 * editing is switched off (`editableInAdmin: false`), and, in development, syncing the
 * files after them.
 *
 * Content stays editable: terms, global values, menu items and a collection's preview
 * address (which differs between a developer's computer and the live site, so it isn't
 * kept in the files) can always be changed.
 */

interface ModelRequest {
  method: string;
  url: string;
  body: unknown;
}

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function changesContentModel({ method, url, body }: ModelRequest): boolean {
  if (!WRITE_METHODS.has(method)) {
    return false;
  }
  const path = (url.split("?")[0] ?? "").replace(/\/+$/, "");
  const [, area, handle, rest] = path.split("/");
  if (area === "blueprints") {
    return true;
  }
  if (rest !== undefined) {
    // /taxonomies/:handle/terms, /globals/:handle/values and the like are content.
    return false;
  }
  if (area === "collections") {
    return !(method === "PUT" && handle !== undefined && onlyChanges(body, ["previewUrlPattern"]));
  }
  if (area === "taxonomies" || area === "globals") {
    return method !== "PATCH";
  }
  if (area === "navigation") {
    return method !== "PUT" || !onlyChanges(body, ["items"]);
  }
  return false;
}

/** Requests after which, in development, the database may hold a model the files don't. */
export function mayChangeContentModel(request: ModelRequest): boolean {
  if (!WRITE_METHODS.has(request.method)) {
    return false;
  }
  const area = (request.url.split("?")[0] ?? "").split("/")[1];
  // Setup and switching plugins on make the content types a site starts with.
  return changesContentModel(request) || area === "setup" || area === "plugins";
}

function onlyChanges(body: unknown, allowed: readonly string[]): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    Object.keys(body).every((key) => allowed.includes(key))
  );
}
