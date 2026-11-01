import { HttpError } from "../http/http-errors.js";

export class RoleNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That role doesn't exist. It may have been deleted.");
  }
}

export class BuiltInRoleError extends HttpError {
  constructor(roleName: string, change: string) {
    super(
      400,
      "BUILT_IN_ROLE",
      `${roleName} is one of Lintel's own roles, so you can't ${change}. Create a custom role instead.`,
    );
  }
}

export class RoleNameTakenError extends HttpError {
  constructor(name: string) {
    super(409, "ROLE_NAME_TAKEN", `There is already a role called “${name}”.`);
  }
}

export class RoleInUseError extends HttpError {
  constructor(roleName: string, memberCount: number) {
    const people = memberCount === 1 ? "1 person has" : `${memberCount} people have`;
    super(
      409,
      "ROLE_IN_USE",
      `${people} the ${roleName} role. Give them another role first, then delete it.`,
    );
  }
}

/**
 * Nobody can hand out more than they have themselves; otherwise someone allowed to manage
 * roles could give themselves anything.
 */
export class CannotGrantPermissionError extends HttpError {
  constructor(permissionName: string) {
    super(
      403,
      "CANNOT_GRANT_PERMISSION",
      `You can't give a role “${permissionName}”, because you can't do that yourself.`,
    );
  }
}

export class UnknownPermissionError extends HttpError {
  constructor(permission: string) {
    super(400, "INVALID_REQUEST", `“${permission}” isn't a permission Lintel knows.`);
  }
}
