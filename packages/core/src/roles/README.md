# Roles

A role is a named list of permissions ("Editor": `entries:read`, `entries:publish`).
A user can have several roles; what they may do is all of those lists combined.

| File                  | What it does                                                  |
| --------------------- | ------------------------------------------------------------- |
| `permissions.ts`      | `hasPermission`: the one permission check, wildcards included |
| `roles.table.ts`      | The `roles` and `user_roles` tables                           |
| `roles.service.ts`    | `findPermissionsForUser`: every role's permissions, combined  |
| `roles.repository.ts` | Database reads and writes                                     |

Routes don't call `hasPermission` themselves; they use `requirePermission` from
`src/auth/require-permission.ts`, which also handles "not signed in".
