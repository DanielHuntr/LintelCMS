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

| File                                      | What it does                                                     |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `main.ts`                                 | The program: runs the command line with the real terminal        |
| `command-line.ts`                         | The one list of commands, help, and turning errors into messages |
| `command.ts`                              | What a command is, reading arguments, opening the database       |
| `terminal.ts`                             | Saying things, asking, tables, sizes and paths                   |
| `commands/*.ts`                           | One file per command                                             |
| `doctor/doctor-checks.ts`                 | The checks behind `lintel doctor`, as plain functions            |
| `doctor/doctor-probes.ts`                 | Finding out about the real machine for those checks              |
| `content-model/content-model-commands.ts` | Loading the content model commands from core                     |
| `updating/git-update.ts`                  | `lintel update`: a git clone to the newest release, safely       |

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

## Building

`pnpm --filter @lintel/cli build` compiles to `dist/`, whose `main.js` is the `lintel`
binary. `pnpm lintel` runs the TypeScript directly with tsx.
