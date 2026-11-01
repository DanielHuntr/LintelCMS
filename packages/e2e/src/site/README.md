# Test sites

Running a copy of Lintel for the browser tests.

| File                | What it does                                                         |
| ------------------- | -------------------------------------------------------------------- |
| `test-site.ts`      | `startSite()`: a site in a temporary folder, in a process of its own |
| `site-process.ts`   | That process: starts the servers, seeds when asked, stops on SIGTERM |
| `site-servers.ts`   | The API (`buildServer` on the built-in database) and the admin       |
| `admin-server.ts`   | Serves the built admin and passes `/api` on to the API               |
| `admin-build.ts`    | Builds the admin with `VITE_API_URL=/api`, only when it changed      |
| `site-templates.ts` | The empty and seeded templates every test site is copied from        |
| `seed-site.ts`      | What the seeded site contains, written through the API               |
| `api-client.ts`     | A small API client that signs in and keeps the session cookie        |
| `accounts.ts`       | The owner and editor accounts                                        |

Each site runs in its own process because the built-in database keeps several hundred MB until
its process ends. The admin and API share one origin through the proxy, as they would behind
a reverse proxy in production, so one admin build serves every site.

The editor account is written straight to the database because there is no API for inviting
people yet; switch `addEditor` to that API when it exists.
