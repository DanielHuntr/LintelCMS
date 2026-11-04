# Commands

One file for each `lintel` command, each read from top to bottom without a guide.

| File              | What it does                                                           |
| ----------------- | ---------------------------------------------------------------------- |
| `start.ts`        | Runs Lintel under a small supervisor that restarts it and updates it   |
| `update.ts`       | Installs an update                                                     |
| `migrate.ts`      | Brings the database up to date                                         |
| `doctor.ts`       | Checks an install for problems                                         |
| `create-admin.ts` | Makes an Owner, for when the setup screen can't                        |
| `backup.ts`       | Makes a backup of the whole site                                       |
| `restore.ts`      | Puts a backup back                                                     |
| `export.ts`       | Exports content to move it to another Lintel, without users or secrets |
| `import.ts`       | Brings an export in                                                    |
| `model.ts`        | Pulls, pushes, compares and checks the content model kept in files     |
| `templates.ts`    | Makes the Liquid templates folder and its editor snippets              |
| `addons.ts`       | Adds, removes, lists, starts and builds add-ons                        |
| `apps.ts`         | Starts a new external app (see `../apps`)                              |

Commands say what went wrong in plain English. The work itself belongs in `packages/core`; a
command only reads what was typed and calls it.
