# Publishing

Settings → Publishing: places the website is published to as files (see `src/static-site`
for the files themselves). For people whose host can't run Lintel: Lintel runs somewhere
that can (their own computer, a small cloud server) and uploads the site to the host they
already have.

## Destinations

Each destination publishes one site (`siteId`, the default site when null).

| Kind     | How                                   | Forms                                |
| -------- | ------------------------------------- | ------------------------------------ |
| `zip`    | Downloaded, uploaded by hand          | the PHP companion                    |
| `ftp`    | FTP or FTPS (explicit TLS by default) | the PHP companion                    |
| `sftp`   | SFTP, password or private key         | the PHP companion                    |
| `s3`     | Any S3-compatible bucket              | Lintel's API (buckets can't run PHP) |
| `folder` | A folder on this machine              | the PHP companion                    |

Passwords and keys are sealed with the server's secret key (`src/secrets`) and never sent
back; responses say only which are saved. Plain FTP works but every response warns about it.

## A publish

`publish-runs.service.ts`, one at a time per destination:

1. Collect what the PHP companion took in since last time (`src/bridge`), so the shop's
   stock is current.
2. Export into `.lintel/published/<target id>/`; only changed pages are drawn again.
3. Read `.lintel-published.json` on the host: what Lintel uploaded last time.
4. Upload what is new or different (pictures first, pages next, server settings last),
   each to a temporary name and then renamed into place where the protocol allows.
5. Delete files Lintel uploaded before that the site no longer has. More than the
   destination's `deleteLimit` (50 by default) waits for someone to confirm: the run ends
   as `needsConfirmation` and nothing is deleted. Files put there by hand are never touched.
6. Upload the companion's private files beside the website (`../lintel-private`), or, if the
   account can't write there, into a `lintel-private` folder inside it that protects itself.
7. Write `.lintel-published.json` last, and record the run with what changed.

Publishes start from the admin's "Publish website", from `lintel publish`, or by themselves
a minute after content is published (`publishAutomatically`), scheduled publishing
included. Every five minutes the companion on each published site is asked for new form
submissions and orders.

## Endpoints

See the comment at the top of `publishing.routes.ts`. Everything needs `settings:read` to
look and `settings:update` to change or publish.

| File                      | What it does                                              |
| ------------------------- | --------------------------------------------------------- |
| `publishing.table.ts`     | `publish_targets`, `publish_runs`, `bridge_receipts`      |
| `publishing.schema.ts`    | Requests                                                  |
| `publishing.routes.ts`    | HTTP                                                      |
| `publishing.service.ts`   | Destinations: create, change, describe, test              |
| `publish-runs.service.ts` | One publish, start to finish                              |
| `upload-plan.ts`          | What to upload and delete, and the delete limit           |
| `target-remotes.ts`       | Opening the right connection for a destination            |
| `remotes/*`               | FTP, SFTP, S3 and folder, behind one interface            |
| `zip-download.service.ts` | The ZIP download                                          |
| `register-publishing.ts`  | `server.publishing`, publishing automatically, collecting |
| `publishing.errors.ts`    | Named errors, and connection problems in plain words      |
