import { hasPermission, type Permission } from "@lintel/core/permissions";
import type { Role } from "./people.api.js";

/**
 * Whether someone may give this role: they must be able to do everything it allows, which
 * is the rule the API applies. Only owners hold "*", so only owners can make owners.
 * Used to offer only the roles that would work, so nobody meets an error for choosing one.
 */
export function canGrantRole(role: Role, granted: readonly string[]): boolean {
  return role.permissions.every((permission) => {
    if (permission === "*" || permission.endsWith(":*")) {
      return granted.includes("*") || granted.includes(permission);
    }
    return hasPermission(granted, permission as Permission);
  });
}

export function grantableRoles(roles: readonly Role[], granted: readonly string[]): Role[] {
  return roles.filter((role) => canGrantRole(role, granted));
}
