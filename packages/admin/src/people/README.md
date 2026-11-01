# People

The Users screen, roles and the invitation accept screen.

| File                                 | What it does                                                       |
| ------------------------------------ | ------------------------------------------------------------------ |
| `UsersPage.tsx`                      | `/users`: search, invitations waiting, everyone, "Invite someone"  |
| `PersonRow.tsx`                      | One person: picture, name, email, last active, role badges         |
| `PersonSheet.tsx`                    | One person's details: change role, deactivate, reactivate, remove  |
| `RemovePersonDialog.tsx`             | Removing someone, after choosing who gets their content            |
| `InviteDialog.tsx`                   | Email and role; then the link, shown once, to pass on by hand      |
| `InvitationList.tsx`                 | Invitations not accepted yet, with resend and cancel               |
| `RolesPage.tsx`                      | `/users/roles`: Lintel's roles, then the site's own                |
| `RoleEditorPage.tsx`                 | `/users/roles/$roleId` (or `new`): name, two-factor, permissions   |
| `PermissionEditor.tsx`               | One switch per permission, in words, grouped by area               |
| `AcceptInvitationPage.tsx`           | `/accept-invitation#token=...`: choose a name and password, join   |
| `grantableRoles.ts`                  | Which roles the signed-in person may give (the API's rule)         |
| `peopleRoutes.tsx`                   | The routes for these screens, account and security, for router.tsx |
| `people.api.ts`, `people.queries.ts` | API calls and their TanStack Query hooks                           |

The roles offered when inviting or changing someone are only those the signed-in person may
give, so nobody meets an error for a choice that couldn't work. The API checks again.
Messages about the last owner and owners-only changes come from the API, which words them
for people.
