# @lintel/cli

The `lintel` command: backups, moving sites, imports, the content model and a check of
the machine, from the terminal. Run it from the repository root:

```bash
pnpm lintel help
pnpm lintel <command> --help
```

Every command and its options are described for people in the docs ("Command line
reference", `packages/docs/src/content/docs/building/command-line.md`).

## How it is put together

The tool only reads arguments, calls core and prints what happened; the rules all live in
core, imported through `@lintel/core/data-tools` (`packages/core/src/data-tools.ts`).

| File                                      | What it does                                                       |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `main.ts`                                 | The program: runs the command line with the real terminal          |
| `command-line.ts`                         | The one list of commands, help, and turning errors into messages   |
| `command.ts`                              | What a command is, reading arguments, opening the database         |
| `terminal.ts`                             | Saying things, asking, tables, sizes and paths                     |
| `commands/*.ts`                           | One file per command                                               |
| `doctor/doctor-checks.ts`                 | The checks behind `lintel doctor`, as plain functions              |
| `doctor/doctor-probes.ts`                 | Finding out about the real machine for those checks                |
| `content-model/content-model-commands.ts` | Loading the content model commands from core                       |
| `commands/templates.ts`                   | `lintel templates init` and `sync`: Liquid templates' editor help  |
| `updating/git-update.ts`                  | `lintel update`: a git clone to the newest release, safely         |
| `commands/addons.ts`                      | `lintel addons ...`: the subcommands below                         |
| `addons/addon-install.ts`                 | `add`, `remove`, `list`, `link`, `unlink`, with npm doing installs |
| `addons/addon-build.ts`                   | `build`: both halves bundled with esbuild, shared modules left out |
| `addons/addon-scaffold.ts`                | `new`: a new add-on (files in `addon-template.ts`)                 |
| `addons/addon-commands.ts`                | `lintel <add-on id>:<command>`, and listing them in `lintel help`  |
| `commands/apps.ts`                        | `lintel apps new`: a new external app                              |
| `apps/app-scaffold.ts`                    | Copies `templates/app` (a plain Node app) and fills in its name    |

Everything that talks to the person goes through `Terminal`, so tests run commands with a
recording terminal and check what was said (`command-line.test.ts`).

Named errors from core (`HttpError` and its kind) and `CommandError` are printed as one
sentence with exit code 1. Anything else is a bug and keeps its stack trace.

## lintel start, update and --version

`lintel start` runs Lintel in production under the supervisor in core
(`packages/core/src/updates/supervisor`), which restarts it if it stops and installs updates
from Settings → Updates. `lintel update` is for copies run from a git clone: it refuses to
start while tracked files have changes, makes a backup, checks out the release tag (or
follows the branch when there are no tags), runs `pnpm install` and the migrations, and
says to restart `pnpm dev`. `lintel --version` prints the version. They use
`@lintel/core/updates` (`packages/core/src/updates/command-line-updates.ts`).

## lintel model

`lintel model pull|push|diff|types|check` runs the content model commands in core's
`src/content-model-sync/model-commands.ts`, exported as
`@lintel/core/content-model-commands`. They are loaded when `lintel model` runs and
checked for every function the command uses (`content-model/content-model-commands.ts`),
so the tool builds, and its other commands work, in a copy of Lintel without them; there
`lintel model` says Lintel needs updating. The folder and types file come from
`CONTENT_MODEL_FOLDER`, `CONTENT_MODEL_FORMAT` and `CONTENT_MODEL_TYPES_FILE`, with the
server's defaults.

`types` reads the model through `diffModel`, so it opens the database even when it writes
types from the files; `check` needs no database.

## lintel templates

`lintel templates init` makes the Liquid templates folder with a working example and writes
VS Code snippets; `sync` writes the snippets again. Both call
`@lintel/core/liquid-editor-commands` (`packages/core/src/liquid-editor-support`). The
fields are read from the content model files when there are some, else from the database;
when `pnpm dev` holds the built-in database, `init` still makes the folder and says how to
get the field snippets, and `sync` says there's nothing to do, since `pnpm dev` keeps them
up to date.

## lintel addons

Add-ons install into `addons/` in the Lintel folder (see `packages/core/src/addons`).
`add` runs `npm install` there, checks the package is an add-on that works with this
version (and uninstalls it if not), and adds it to `lintel-addons.json` to be switched on at
the next start. `remove` uninstalls it and keeps its data. `link` and `unlink` use a folder
being worked on instead. `new` writes a working add-on that links to this checkout of
Lintel; `build` bundles one with esbuild (imported only when it runs). Add-ons' own
commands run as `lintel <id>:<name>`, with the database open and the add-on's tables up to
date; `lintel help` lists them.

## Building

`pnpm --filter @lintel/cli build` compiles to `dist/`, whose `main.js` is the `lintel`
binary. `pnpm lintel` runs the TypeScript directly with tsx.
