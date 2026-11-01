# 13. Fixed built-in roles, "own" permissions and an always-present owner

Date: 2026-11-01

## Decision

Every site has five built-in roles (Owner, Admin, Editor, Author, Viewer) whose permissions
are defined in code and kept in line by `ensureBuiltInRoles` whenever roles are listed or an
owner is created; admins can't edit them,
only require two-factor for them. Anything else is a custom role.

"Only their own content" is expressed as separate permissions (`entries:update-own`,
`entries:publish-own`, `entries:delete-own`) checked against the entry's `createdBy`, rather
than as a flag on the role.

The site always keeps one active Owner, and nobody can hand out a permission they don't hold.

## Why

- **Roles mean the same thing everywhere.** Agencies support many sites; "Editor" must not
  quietly mean something different on each. Fixed roles also improve on every site when a
  new Lintel version refines them.
- **"Own" as permissions keeps one check.** `hasPermission` stays the only rule, wildcards
  (`entries:*`) include the own variants for free, and a custom role can mix them ("edit
  anyone's, publish only your own").
- **No lock-outs, no escalation.** The last-owner rule means a site can always be managed
  from the admin. The grant rule means someone allowed to manage roles can't use that to
  give themselves more.
