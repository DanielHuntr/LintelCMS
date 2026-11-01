# 25. Updates from the admin, installed by a supervisor beside the server

Date: 2026-11-01

## Decision

Lintel looks for new versions itself (GitHub releases by default, `UPDATE_FEED_URL`
otherwise) and shows them in Settings → Updates, the sidebar and the dashboard. How it
installs one depends on how it was installed, which it works out and explains:

- Started with `lintel start`, a small supervisor runs the server as a child process and
  keeps versions side by side (`versions/<version>`, with `current` pointing at the one
  running). The Update button makes a backup, downloads the release's build, checks its
  minisign signature against a key compiled into Lintel and its SHA-256, unpacks it, and
  hands over to the supervisor, which shows a maintenance page, runs the migrations, swaps
  `current`, restarts and waits for `/ready`, and goes back by itself (restoring the backup
  if migrations ran) when anything fails.
- Docker shows the two commands; an opt-in `lintel-updater` service with the Docker socket
  runs them when the button is pressed.
- A git clone uses `lintel update`, which refuses to touch uncommitted work.
- Shared hosting (Passenger) and Laravel Forge are recognised and get their own steps.

Only owners can install or roll back; both are written to the security log.

## Why

The people we build for won't pull, install and migrate by hand, and shouldn't have to.
But a CMS replacing its own code is the riskiest thing it does, so:

- **The process being replaced never replaces itself.** The server prepares (backup,
  download, checks, unpack) while still serving; the switch is done by a process that
  survives it. That is also why Docker gets commands, not a button: from inside, a container
  can only replace itself by being given the keys to the whole machine, which people must
  choose knowingly.
- **Side-by-side versions make going back a pointer change.** The old version is still on
  disk, untouched, so a failed start is undone in seconds without downloading anything.
- **Nothing runs that wasn't signed by us.** HTTPS alone trusts GitHub and every proxy on
  the way; a signature over `SHA256SUMS` trusts only the release key. minisign's format
  lets releases be signed with the standard tool or our script, and Node's built-in
  Ed25519 checks it without a dependency.
- **A backup comes first, every time,** and it is an ordinary backup people can find in
  Settings → Backups.
- **Privacy.** A check is one GET of a public list; nothing about the site is sent, and
  `UPDATE_CHECKS=off` stops even that.

## Consequences

- Releases must carry a build per platform plus `SHA256SUMS` and its signature
  (`scripts/release` makes them locally; publishing stays a person's job). The private key
  must be kept safe; losing it means shipping a release by hand that carries a new key.
- Migrations must stay additive between releases, so an older version can run on a newer
  database after a roll back. A release that can't promise this says `Breaking: yes`, and
  `Minimum version:` stops sites skipping a release whose migrations later ones rely on.
- The supervisor's own code is replaced only when the supervisor is restarted (by systemd,
  or by hand), which is acceptable because it is small and changes rarely.
- Passenger and Forge are only recognised and explained for now; installing the hosting
  package into `versions/` and touching `tmp/restart.txt` comes with shared hosting support.
