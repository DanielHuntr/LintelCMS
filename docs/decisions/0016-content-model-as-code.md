# 16. The content model can live in files, which win

Date: 2026-11-01

## Decision

Content types (blueprints with their collections), taxonomies, global sets and menus can
be kept as files in a `content-model/` folder, one file per thing, written in TypeScript
(`defineContentType`, `text()`, `blocks({...})`) or YAML. When the folder exists it is the
source of truth:

- **Production** applies the files when the server starts. Additive changes go ahead;
  changes that would delete content wait for an explicit confirmation (the admin, or
  `model push --allow-data-loss`). The admin can't edit the model (`editableInAdmin` is
  off), and says why.
- **Development** syncs both ways: file edits are applied as they're saved, admin changes
  are written to the files, and when both changed the file wins and the admin is told.
  Each unit's last synced version is kept as a hash (the `contentModelSyncBase` setting)
  to tell which side moved.

The database stays the runtime store: every request reads the model from the database as
before, and files are applied through the same services the admin uses, so every rule
lives in one place. Content (entries, terms, global values, menu items) is never in files.

`model types` generates one self-contained TypeScript file with each content type's
delivered shape and a typed delivery client, for websites.

## Why

Agencies need the model in version control: reviewed in pull requests, identical on every
environment, deployable without clicking through an admin. Statamic (blueprints as files)
and Umbraco (uSync, Deploy and Models Builder) show the demand. Non-technical editors
still need the admin to be a good way to build the model, which is why development is
two-way rather than files-only.

Keeping the database as the runtime store, rather than reading files on every request,
means nothing else in Lintel changed, the built-in database and Postgres behave the same,
and a deploy with broken files leaves the last good model in place.

Destructive changes are decided by looking at the data, not just the change: removing a
field nobody filled in is harmless and goes ahead, while removing one with content is
held back and described in plain English with counts. Silent data loss on deploy is the
failure that would make people distrust the feature.

Files are written by Lintel in one fixed layout (keys in order, defaults left out,
Prettier's style) rather than edited in place with an AST library. That keeps them
diff-friendly and the implementation small; comments at the top of a file are kept, and
files whose content didn't change are never rewritten.

## Alternatives considered

- **Files only, no admin editing**: simplest, but takes the blueprint builder away from
  the people it was made for.
- **Reading the model from files at runtime**: no sync step, but every feature that reads
  blueprints would need a second source, and a typo in a file would break the live site.
- **Migrations generated from the model** (Prisma-style): precise, but a history of
  migration files is more than most sites need, and it doesn't fit two-way editing.
- **Editing files with ts-morph** to keep every comment: heavier, and fragile against
  hand-written code; owning the layout gives stable diffs instead.
