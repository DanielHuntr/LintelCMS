# Starting an external app

`lintel apps new <name>` (`app-scaffold.ts`): makes a new external app in plain Node, ready to run
and install. It has its manifest, a server, a page inside the admin using `@lintel/app-bridge`,
the session token and webhook checks, tests and a README. The files it copies are in
`packages/cli/templates/app`.

The command itself is in `../commands/apps.ts`. What apps are, and how Lintel treats them, is in
`packages/core/src/apps`.
