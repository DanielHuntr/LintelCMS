import { existsSync } from "node:fs";
import { join } from "node:path";
import { ConfigError, loadConfig, loadProjectEnvFile } from "../config.js";
import { REPOSITORY_ROOT } from "../plugins/installed-plugins.js";
import { DEFAULT_ADMIN_BUILD_FOLDER } from "../production/admin-app.js";
import {
  checkDataFolderIsWritable,
  DataFolderNotWritableError,
} from "../production/data-folder.js";
import { lintelPaths } from "../startup.js";
import { findHostingChecker, runHostingChecks } from "./hosting-checker.js";

/**
 * `lintel doctor`: checks what stops Lintel starting (its settings, its data folder, the
 * built admin) without starting it. `--hosting` adds the hosting checker's report: Node.js
 * version, memory, image resizing, internet access.
 */
export async function runDoctorCommand(
  options: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
  root = REPOSITORY_ROOT,
): Promise<number> {
  if (environment === process.env) loadProjectEnvFile();
  const problems: string[] = [];
  let dataFolder: string | undefined;
  const say = (line: string) => process.stdout.write(`${line}\n`);

  try {
    const config = loadConfig(environment);
    say("[OK] Settings: every setting is valid");
    dataFolder = lintelPaths(config).root;
    checkDataFolderIsWritable(dataFolder);
    say(`[OK] Data folder: ${dataFolder} can be written to`);
    const adminFolder = config.ADMIN_BUILD_FOLDER ?? DEFAULT_ADMIN_BUILD_FOLDER;
    if (existsSync(join(adminFolder, "index.html"))) {
      say("[OK] Admin: built");
    } else {
      problems.push(`The admin isn't built (looked in ${adminFolder}). Run \`pnpm build\`.`);
    }
  } catch (error) {
    if (!(error instanceof ConfigError || error instanceof DataFolderNotWritableError)) throw error;
    problems.push(error.message);
  }

  let blocked = false;
  if (options.includes("--hosting")) {
    const checker = findHostingChecker(root);
    // The folders this copy of Lintel really uses, rather than the hosting package's.
    const report = await runHostingChecks(checker, root, dataFolder ? [dataFolder] : undefined);
    say(checker.formatText(report));
    blocked = report.verdict === "blocked";
  }

  for (const problem of problems) say(`[Problem] ${problem}`);
  if (problems.length === 0 && !blocked) say("\nNothing stops Lintel from running.");
  return problems.length > 0 || blocked ? 1 : 0;
}
