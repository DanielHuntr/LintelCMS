# Updates

Telling people there is a new version of Lintel (or of a plugin they installed) and, where
it can be done safely, installing it from Settings → Updates. See
`docs/decisions/0025-updates-from-the-admin.md` for why it works this way, and the guides
"Updating Lintel" (for site owners) and "Releases and the update feed" (for whoever
publishes releases).

## Looking for updates

Once a day (the scheduler checks hourly whether a day has passed) and when someone presses
**Check now**, `update-checks.service.ts` fetches the feed: GitHub's releases for
`DanielHuntr/LintelCMS` unless `UPDATE_FEED_URL` says otherwise. `update-feed.ts` reads it
into versions with a channel (stable, or beta for pre-releases), notes as safe HTML (Markdown,
with raw HTML shown as text), a security flag, a breaking flag and a minimum version.
Installed npm plugins from `lintel.config.ts` are looked up in the npm registry
(`plugin-updates.ts`). The result is kept in the `updateCheck` setting. Owners are emailed
once about each new security release. `UPDATE_CHECKS=off` stops all of it.

Privacy: a check is a plain GET with `User-Agent: Lintel` (GitHub requires one). Nothing
about the site, not even the running version, is sent.

## How this copy is updated

`install-type.ts` works out how Lintel was installed (`LINTEL_INSTALL_TYPE` overrides it):

| Type         | Seen by                                             | What Settings → Updates offers                            |
| ------------ | --------------------------------------------------- | --------------------------------------------------------- |
| `supervised` | `LINTEL_SUPERVISED=1`, set by `lintel start`        | The Update button, and Roll back                          |
| `docker`     | `LINTEL_DOCKER=1` (the Dockerfile) or `/.dockerenv` | Two commands; the button with the opt-in `lintel-updater` |
| `passenger`  | `IN_PASSENGER`, `PASSENGER_APP_ENV`                 | The hosting package's steps (by hand for now)             |
| `forge`      | `FORGE_SITE_PATH`, or under `/home/forge/`          | Forge's deploy and restart steps                          |
| `source`     | a `.git` folder                                     | `pnpm lintel update`, then restart                        |
| `process`    | anything else (`pnpm start`)                        | How to switch to `lintel start`                           |

## The Update button (supervised installs)

`update-install.service.ts`, owners only, written to the security log:

1. `release-download.ts` downloads `lintel-<version>-<platform>-<arch>.tar.gz`, checks the
   minisign signature of `SHA256SUMS` against the key in `release-public-key.ts` (or
   `UPDATE_PUBLIC_KEY`) and the build's SHA-256 against it, and unpacks it into
   `versions/<version>` (with Windows' own `tar` on Windows);
2. on a Postgres server, an update whose release has migrations the running one doesn't is
   refused here: that database can't be copied to go back to;
3. a backup of the whole site (Settings → Backups, "Before an update"), for people to keep;
4. the server asks the supervisor (Node IPC) to switch.

The supervisor (`supervisor/`) stops the server, answers the site's address with a
maintenance page, copies the built-in database's folder while it holds its lock
(`database-copies.ts`), runs the new version's migrations, points `current` at it, starts
it and waits for `/ready`. If any of that fails it stops the new version, puts the database
copy back if migrations had begun, points `current` back and starts the old version.
Progress is in `versions/update-status.json`, which the maintenance page serves at
`/api/updates/progress` while the server is down, so the admin follows the whole thing.
Before each step `versions/switch-journal.json` records how far it got; a supervisor that
starts and finds it finishes or reverses that switch first (`switch-journal.ts`).
`install-home.ts` describes the folder layout.

Roll back (Settings → Updates → Earlier versions) switches to a version kept on disk, and
can put back the database copy made when Lintel left it. When the running version has
migrations the older one doesn't know, putting the copy back is required, and without the
copy the roll back is refused. See `docs/decisions/0041-going-back-a-version.md`.

## Endpoints

See `updates.routes.ts`. Seeing updates needs `updates:read` (Owner and Admin); installing
and rolling back also need the Owner role.

## Files

| File                             | What it does                                              |
| -------------------------------- | --------------------------------------------------------- |
| `semantic-version.ts`            | Reading and comparing versions, pre-releases included     |
| `lintel-version.ts`              | The running version, from packages/core/package.json      |
| `update-feed.ts`                 | GitHub's releases or a Lintel feed → versions with notes  |
| `update-checks.service.ts`       | Checking, the channel, the badge count, security emails   |
| `plugin-updates.ts`              | Newer versions of installed npm plugins                   |
| `install-type.ts`                | Which kind of install this is, and how it is updated      |
| `release-signature.ts`           | minisign signatures and SHA256SUMS                        |
| `release-public-key.ts`          | The release key's public half                             |
| `release-download.ts`            | Download, check and unpack a release into versions/       |
| `install-home.ts`                | versions/, `current`, the status and history files        |
| `update-install.service.ts`      | The Update and Roll back buttons                          |
| `updates.service.ts`             | What Settings → Updates shows                             |
| `updates-runtime.ts`             | Options, and the update in progress (`server.updates`)    |
| `updates.config.ts`              | `UPDATE_FEED_URL`, `UPDATE_CHECKS` and the other settings |
| `supervisor/supervisor.ts`       | Switching versions, and rolling back by itself on failure |
| `supervisor/run-supervisor.ts`   | `lintel start`: the real child process, port and clock    |
| `supervisor/maintenance-page.ts` | What the site shows while no server is running            |
| `supervisor/database-copies.ts`  | Copying the built-in database at a switch, and back       |
| `supervisor/switch-journal.ts`   | How far a switch got, to finish or undo it after a stop   |
