// Lintel's command line, in the shared-hosting package: `node lintel.js <command>`.
//
//   node lintel.js cron                 run the scheduled jobs now (through the website)
//   node lintel.js cron --print-line    print the line for the host's Cron Jobs screen
//   node lintel.js doctor --hosting     check this server can run Lintel
//
// The same commands are package.json scripts, so cPanel's "Run JS script" button runs them.
"use strict";

import("./packages/core/dist/cli/lintel.js")
  .then((cli) => cli.runCommandLine(process.argv.slice(2)))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
