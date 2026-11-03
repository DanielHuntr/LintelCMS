# Hosting

Running Lintel where a hosting control panel starts it: cPanel's "Setup Node.js App"
(Passenger), Plesk, and anything else that runs a startup file. The production server is
the same one `pnpm start` runs (see `src/production`); this folder only adds the ways such
hosts start it, the package people upload, and the checker they run first.

## The startup file

`files/app.cjs` becomes `app.js` in the hosting package. It is CommonJS, because every
Passenger version loads that, and calls `startHostedApp` (`hosted-app.ts`), which picks
how to receive requests (`listen-mode.ts`):

| Situation                                       | What happens                              |
| ----------------------------------------------- | ----------------------------------------- |
| Under Passenger (`PhusionPassenger` is defined) | `listen("passenger")`                     |
| `node app.js`                                   | Listens on `PORT` (or 4000)               |
| Loaded by a wrapper that sets `PORT` (lsnode)   | Listens on `PORT`; the wrapper catches it |
| Loaded by a wrapper with no `PORT`              | Only exports the request handler          |

`LINTEL_LISTEN=true|false` overrides the guess. The listener opens straight away, before
the database is ready, because Passenger gives up on slow starters; early requests wait.
Under Passenger:

- the visitor's address comes in `X-Forwarded-For` over a socket only Passenger can
  reach, so `TRUST_PROXY` defaults to true there;
- Passenger's "exit" event closes the database cleanly before the process ends;
- the built-in database waits up to 20 seconds for the copy being replaced to let go;
- `PUBLIC_URL` is required, since there is no sensible address to guess.

If Lintel can't start, every address answers 503 with a page that says why
(`startup-problem-page.ts`): problems Lintel explains are shown, anything else points to
`stderr.log`. Restarting is Passenger's `tmp/restart.txt`, which the package includes.

## The hosting package

`pnpm build:hosting` (root) builds everything, then `build-hosting-package.ts` makes
`dist-hosting/lintel-hosting-<version>.zip` (`zip-folder.ts` writes the zip; no
dependencies). The layout copies the repository's, so every path Lintel works out from
its own files is unchanged; workspace packages go in `packages/core/node_modules`, which
npm leaves alone and Node finds. `hosting-package.ts` works out the npm dependencies, at
the exact versions installed in the workspace, and writes the plain package.json: no
`type` (so app.js is CommonJS), no workspaces, production dependencies only, and scripts
for cPanel's "Run JS script" button (`check`, `doctor`, `cron`, `cron-line`).

## The checkers

- `files/lintel-check.cjs` (`lintel-check.js` in the package): one dependency-free file,
  written for old Node versions too so it can say when one is too old. Uploaded and run as
  a Node.js app it shows an HTML report; `node lintel-check.js` prints it. It checks the
  Node version (22+), the account's memory limit, a virtual memory limit (which stops the
  built-in database's WebAssembly), writable folders, whether sharp loads, and outbound
  HTTPS, and ends with "Lintel will run here" or what to ask the host.
  `lintel doctor --hosting` runs the same file (see `src/cli`).
- `files/lintel-check.php`: for hosting that may only run PHP. Says whether "Setup Node.js
  App" seems to be there and recommends running Lintel there, publishing the site there
  as files (with `lintel-bridge.php` for forms and checkout), or what to ask for.

## Files

| File                       | What it does                                            |
| -------------------------- | ------------------------------------------------------- |
| `hosted-app.ts`            | Starts the production server the way the host expects   |
| `listen-mode.ts`           | Passenger, a port, or only a handler                    |
| `startup-problem-page.ts`  | The page shown when Lintel can't start                  |
| `build-hosting-package.ts` | `pnpm build:hosting`                                    |
| `hosting-package.ts`       | Which packages and dependencies go in, and package.json |
| `zip-folder.ts`            | Writes the zip                                          |
| `files/`                   | Copied into the package as they are                     |

`hosting-package.e2e.test.ts` builds the package, installs it with plain npm in a
temporary folder and starts it; it runs with `LINTEL_HOSTING_E2E=1 pnpm test` after
`pnpm build`.
