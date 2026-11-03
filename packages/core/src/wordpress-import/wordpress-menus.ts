import { type ImportedMenuLink, saveImportedMenu } from "../importers/imported-menus.js";
import { done, type ItemContext, type ItemResult, skipped } from "./wordpress-import-context.js";
import type { WordPressMenu, WordPressMenuLink } from "./wxr-parser.js";

/**
 * A WordPress menu becomes a menu here, with the same links in the same order and nesting.
 * Links to pages and posts point at the entries they became; typed addresses on the old
 * site ("https://old-site.example/visit/") become addresses on this one ("/visit/").
 * Links to category archives have no equivalent yet, so they're left out and counted.
 */
export async function importMenu(context: ItemContext, menu: WordPressMenu): Promise<ItemResult> {
  if (!context.mapping.menus) {
    return skipped("Menus were left out on the mapping screen.");
  }
  if (menu.links.length === 0) {
    return skipped("This menu has no links.");
  }
  const saved = await saveImportedMenu(context.database, context.siteId, {
    name: menu.name,
    links: linksUnder("0", menu.links, context, new Set()),
  });
  return done(saved.navigationId, {
    title: menu.name,
    handle: saved.handle,
    ...(saved.leftOut > 0 ? { menuLinksLeftOut: saved.leftOut } : {}),
  });
}

function linksUnder(
  parentId: string,
  links: readonly WordPressMenuLink[],
  context: ItemContext,
  seen: Set<string>,
): ImportedMenuLink[] {
  return links
    .filter((link) => link.parentId === parentId && !seen.has(link.id))
    .sort((first, second) => first.order - second.order)
    .map((link) => {
      seen.add(link.id);
      return {
        label: link.label,
        ...target(link, context),
        children: linksUnder(link.id, links, context, seen),
      };
    });
}

function target(link: WordPressMenuLink, context: ItemContext) {
  if (link.linkType === "post_type") {
    const entryId =
      context.targets.get(`page:${link.linkedId}`) ??
      context.targets.get(`post:${link.linkedId}`) ??
      null;
    return { entryId, url: null };
  }
  if (link.linkType === "custom") {
    return { entryId: null, url: onThisSite(link.url, context.siteAddress) };
  }
  return { entryId: null, url: null };
}

/** An address on the old site becomes the same path here; others are kept as typed. */
export function onThisSite(url: string, siteAddress: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    const site = new URL(siteAddress);
    const bare = (host: string) => host.replace(/^www\./, "");
    if (bare(parsed.host) === bare(site.host)) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}
