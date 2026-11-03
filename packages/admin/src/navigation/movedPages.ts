import { redirect } from "@tanstack/react-router";
import type { StringKey } from "../i18n/strings.js";

/** A screen that has a new address. The old one still works: it sends people on. */
export interface MovedPage {
  from: string;
  to: string;
  /** Its name, for Settings search: "Content types is now in Build". */
  label: StringKey;
  /** Where it is now, in words. */
  nowIn: StringKey;
}

/**
 * Settings held everything, so the things the agency builds with moved to Build, the
 * security log and sent emails to Users, and the admin's language to Account.
 */
export const movedPages: readonly MovedPage[] = [
  {
    from: "/settings/content-types",
    to: "/build/content-types",
    label: "contentTypes.title",
    nowIn: "nav.build",
  },
  {
    from: "/settings/fieldsets",
    to: "/build/fieldsets",
    label: "fieldsets.title",
    nowIn: "nav.build",
  },
  {
    from: "/settings/features",
    to: "/build/features",
    label: "features.title",
    nowIn: "nav.build",
  },
  { from: "/settings/sites", to: "/build/sites", label: "sites.title", nowIn: "nav.build" },
  {
    from: "/settings/branding",
    to: "/build/branding",
    label: "branding.title",
    nowIn: "nav.build",
  },
  { from: "/settings/api", to: "/build/api", label: "apiAccess.title", nowIn: "nav.build" },
  {
    from: "/settings/webhooks",
    to: "/build/webhooks",
    label: "webhooks.title",
    nowIn: "nav.build",
  },
  { from: "/settings/import", to: "/build/import", label: "import.title", nowIn: "nav.build" },
  {
    from: "/settings/security-log",
    to: "/users/activity",
    label: "securityLog.title",
    nowIn: "nav.users",
  },
  {
    from: "/settings/email-outbox",
    to: "/users/emails",
    label: "emailOutbox.title",
    nowIn: "nav.users",
  },
  {
    from: "/settings/interface-language",
    to: "/account/language",
    label: "interfaceLanguage.title",
    nowIn: "account.title",
  },
];

/** The new address for an old one, keeping anything after it ("/settings/webhooks/abc"). */
export function newAddressFor(pathname: string): string | null {
  for (const page of movedPages) {
    if (pathname === page.from) return page.to;
    if (pathname.startsWith(`${page.from}/`)) return page.to + pathname.slice(page.from.length);
  }
  return null;
}

/**
 * For the catch-all route's `beforeLoad`: an old address goes on to the new one, so bookmarks
 * and links in emails or old docs keep working.
 */
export function sendOnFromOldAddress({
  location,
}: {
  location: { pathname: string; searchStr: string };
}) {
  const to = newAddressFor(location.pathname);
  if (to !== null) throw redirect({ href: to + location.searchStr, replace: true });
}
