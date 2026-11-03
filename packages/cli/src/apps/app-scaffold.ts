import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { REPOSITORY_ROOT } from "@lintel/core/updates";
import { CommandError, type Terminal } from "../terminal.js";

/**
 * `lintel apps new <name>`: a new external app in plain Node, ready to run and install.
 * It has its manifest, a server, a page inside the admin using @lintel/app-bridge, the
 * session token and webhook checks, tests and a README. The files are in
 * packages/cli/templates/app, kept as the real files so they can be read and linted as
 * they are; each `__APP_NAME__`, `__APP_HANDLE__` and `__LINTEL_ROOT__` is filled in.
 *
 * Apps run on their own server, unlike add-ons (`lintel addons new`), which run inside
 * Lintel. @lintel/app-bridge isn't on npm yet, so the app links to this copy of Lintel.
 */

export interface AppScaffoldOptions {
  name: string;
  /** Defaults to a folder named after the app, where the command was run. */
  folder?: string;
  terminal: Terminal;
  /** The Lintel checkout to link to; defaults to the one running. */
  lintelRoot?: string;
}

/** Lintel's rule for an app's handle: 2 to 40 lowercase letters, numbers and dashes. */
const HANDLE_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;

/** Two folders up from both src/apps and dist/apps. */
const TEMPLATE_FOLDER = fileURLToPath(new URL("../../templates/app", import.meta.url));

export async function scaffoldApp(options: AppScaffoldOptions): Promise<string> {
  const handle = options.name.trim().toLowerCase();
  if (!HANDLE_PATTERN.test(handle)) {
    throw new CommandError(
      "An app's name is 2 to 40 lowercase letters, numbers and dashes, starting with a letter: lintel apps new stock-sync",
    );
  }
  const folder = options.folder ?? join(options.terminal.workingFolder, handle);
  if (existsSync(folder) && (await readdir(folder)).length > 0) {
    throw new CommandError(`${folder} already has files in it. Choose another name or --folder.`);
  }

  const values: Record<string, string> = {
    __APP_HANDLE__: handle,
    __APP_NAME__: titleFor(handle),
    __LINTEL_ROOT__: (options.lintelRoot ?? REPOSITORY_ROOT)
      .replaceAll("\\", "/")
      .replace(/\/$/, ""),
  };
  for (const path of await templateFiles(TEMPLATE_FOLDER)) {
    const template = await readFile(join(TEMPLATE_FOLDER, path), "utf8");
    const file = join(folder, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, fillIn(template, values));
  }

  const { terminal } = options;
  const shown = relative(terminal.workingFolder, folder) || ".";
  terminal.say(`Made the app "${handle}" in ${shown}. Next:`);
  terminal.say();
  terminal.say(`  cd ${shown}`);
  terminal.say("  npm install");
  terminal.say("  npm test                   checks its session tokens, webhooks and pages");
  terminal.say("  npm start                  runs it at http://localhost:3200");
  terminal.say();
  terminal.say("Then, in Lintel: Build → Apps, turn on Development mode, and Add an app from");
  terminal.say("http://localhost:3200/lintel-app.json. The README says the rest.");
  return folder;
}

/** "stock-sync" → "Stock sync". */
export function titleFor(handle: string): string {
  const words = handle.replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function fillIn(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (text, [token, value]) => text.replaceAll(token, value),
    template,
  );
}

/** Every file under the template folder, as paths relative to it. */
async function templateFiles(folder: string, within = ""): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(join(folder, within), { withFileTypes: true })) {
    const path = within ? `${within}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") found.push(...(await templateFiles(folder, path)));
    } else if (entry.name !== ".env") {
      found.push(path);
    }
  }
  return found;
}
