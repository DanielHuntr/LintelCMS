import { CLIENT_ROLE_HANDLE, OWNER_ROLE_HANDLE } from "../roles/built-in-roles.js";

/** The roles an app's page can name. An app can't know a site's custom roles. */
export const appPageRoleNames = [
  OWNER_ROLE_HANDLE,
  "admin",
  "editor",
  "author",
  CLIENT_ROLE_HANDLE,
  "viewer",
] as const;

export type AppPageRole = (typeof appPageRoleNames)[number];

/** Who doesn't see a page that names no roles: they came to change words or to look. */
const leftOutByDefault: readonly string[] = [CLIENT_ROLE_HANDLE, "viewer"];

/**
 * Whether an app's sidebar page is for someone with these roles.
 *
 * A page that lists `roles` is for those roles and Owners, and nobody else, custom roles
 * included. A page that lists none, as older apps do, is for everyone but clients and
 * Viewers. Someone with several roles sees it if any of them does.
 */
export function appPageIsFor(
  page: { roles?: readonly AppPageRole[] | undefined },
  personsRoles: readonly string[],
): boolean {
  if (personsRoles.includes(OWNER_ROLE_HANDLE)) return true;
  const { roles } = page;
  if (roles) return personsRoles.some((role) => roles.some((listed) => listed === role));
  return personsRoles.some((role) => !leftOutByDefault.includes(role));
}
