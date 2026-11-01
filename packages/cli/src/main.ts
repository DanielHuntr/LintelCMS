#!/usr/bin/env node
import { runWithFriendlyErrors } from "@lintel/core/data-tools";
import { runCommandLine } from "./command-line.js";
import { processTerminal } from "./terminal.js";

/** The `lintel` program. The commands themselves are listed in command-line.ts. */
await runWithFriendlyErrors(async () => {
  process.exitCode = await runCommandLine(process.argv.slice(2), processTerminal);
});
