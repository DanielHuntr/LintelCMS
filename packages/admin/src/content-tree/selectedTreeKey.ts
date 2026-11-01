import { rootKey, type TreeKey } from "./treeState.js";

/** Addresses under /content that belong to the site-wide folders rather than a collection. */
const siteWideFolders: Record<string, string> = {
  globals: "globals",
  navigation: "menus",
  taxonomies: "taxonomies",
};

/**
 * The tree row for the screen the workspace shows, from its address, so the tree can mark
 * it: an entry, a collection's section, or a site-wide folder or item.
 */
export function selectedTreeKey(pathname: string): TreeKey | undefined {
  const [, section, first, second] = pathname.replace(/\/+$/, "").split("/");
  if (section !== "content" || first === undefined || first === "recycle-bin") return undefined;
  const folder = siteWideFolders[first];
  if (folder) {
    return second === undefined ? `site:${folder}` : `${folder}:${decodeURIComponent(second)}`;
  }
  if (second === undefined || second === "new") return rootKey(decodeURIComponent(first));
  return second;
}
