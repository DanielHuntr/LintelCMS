/**
 * Permissions are strings shaped like "area:action", for example "entries:publish".
 *
 * A role can also hold a wildcard:
 *   - "*"          everything (the super admin)
 *   - "entries:*"  every action on entries
 *
 * Keeping them as strings means a role reads clearly in the database and in the admin UI,
 * and plugins can add their own permissions without changing core code.
 */
export type Permission = `${string}:${string}` | "*";

export function hasPermission(granted: readonly string[], required: Permission): boolean {
  if (granted.includes("*") || granted.includes(required)) {
    return true;
  }

  const [area] = required.split(":");
  return granted.includes(`${area}:*`);
}
