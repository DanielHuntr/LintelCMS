# 54. A package for shared hosting, started by Passenger

Date: 2026-11-01

## Decision

Lintel ships a second way to install: `pnpm build:hosting` makes
`lintel-hosting-<version>.zip`, which people upload to hosting with a control panel and
install with that panel's "Run NPM Install" button. Its `app.js` starts the same
production server as `pnpm start` (decision 17), on Passenger's socket, on `PORT`, or as
an exported request handler. Scheduled jobs can also be run by a cron job through
`POST /system/run-scheduled-jobs`, protected by a secret.

## Why

Many of the people we build for already pay for cPanel hosting, and many cPanel hosts
offer "Setup Node.js App" (CloudLinux's Node.js Selector, which runs apps with Passenger).
Asking them to rent and look after a VPS as well is the biggest step between them and a
working site.

- **One port** was already the production model; Passenger gives an app exactly one
  socket, so nothing else would work.
- **A zip, not git and pnpm.** Control panels have a file manager and an npm button, not
  pnpm workspaces. The package keeps the repository's folder layout, so every path Lintel
  works out from its own files stays the same, and puts the workspace packages, already
  built, in `packages/core/node_modules`, which npm doesn't manage. npm installs only
  public packages, at the versions the workspace was tested with.
- **CommonJS `app.js`.** Older Passenger versions can't load an ES module as the startup
  file; app.js imports the ES module build.
- **Cron, not timers alone.** Passenger stops idle apps, and their timers with them. A
  cron request wakes the app (which runs its jobs on start) and runs every job once.
  The secret is made for the site and kept in the data folder unless `CRON_SECRET` is set.
- **The built-in database stays the default**, so no database server is needed; the setup
  wizard still offers the host's PostgreSQL.
- **sharp is loaded lazily.** If its native program can't run on a host, Lintel runs and
  serves images unresized, and says so in the media library, rather than not starting.

## Consequences

- Shared hosts may run a new copy while the old one is stopping; the built-in database
  waits up to 20 seconds for the old copy to let go. The setup code is kept in a file, so
  every copy asks for the same one.
- Memory, measured with the package: about 800 MB on the very first start (the built-in
  database being created), about 460 MB on later starts, of which about 200 MB is the
  built-in database. Accounts with less than 1 GB should use the host's PostgreSQL; the
  checker says so. Making the built-in database smaller is worth doing later.
- A virtual memory limit (older CloudLinux setups) stops the built-in database's
  WebAssembly; the hosting checker says so and points to PostgreSQL.
- Hosting that runs only PHP still can't run Lintel; the PHP checker says so and points
  to publishing the site as files.
