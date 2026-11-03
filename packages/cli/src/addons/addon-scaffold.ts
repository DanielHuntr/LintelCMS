import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { lintelVersion, REPOSITORY_ROOT } from "@lintel/core/updates";
import { CommandError, type Terminal } from "../terminal.js";
import { addonTemplateFiles } from "./addon-template.js";

/**
 * `lintel addons new <name>`: a new add-on with a working example of each part (a field
 * type and its editor, a Liquid tag and filter, a builder element, a dashboard widget, an
 * event handler), tests, and a README saying what to do next. Lintel's packages aren't on
 * npm yet, so it links to the copy of Lintel the command ran from.
 */

export interface ScaffoldOptions {
  name: string;
  /** Defaults to a folder named after the add-on, where the command was run. */
  folder?: string;
  terminal: Terminal;
  /** The Lintel checkout to link to; defaults to the one running. */
  lintelRoot?: string;
}

const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

export async function scaffoldAddon(options: ScaffoldOptions): Promise<string> {
  const id = options.name.trim().toLowerCase();
  if (!NAME_PATTERN.test(id)) {
    throw new CommandError(
      "An add-on's name is lowercase letters, numbers and dashes, starting with a letter: lintel addons new star-ratings",
    );
  }
  const folder = options.folder ?? join(options.terminal.workingFolder, id);
  if (existsSync(folder) && (await readdir(folder)).length > 0) {
    throw new CommandError(`${folder} already has files in it. Choose another name or --folder.`);
  }
  const files = addonTemplateFiles({
    id,
    lintelVersion: lintelVersion(),
    lintelRoot: options.lintelRoot ?? REPOSITORY_ROOT,
  });
  for (const [path, content] of Object.entries(files)) {
    const file = join(folder, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  const { terminal } = options;
  const shown = relative(terminal.workingFolder, folder) || ".";
  terminal.say(`Made the add-on "${id}" in ${shown}. Next:`);
  terminal.say();
  terminal.say(`  cd ${shown}`);
  terminal.say("  npm install");
  terminal.say("  npm test                   its tests, on a real Lintel");
  terminal.say("  npm run build              bundles it into dist/");
  terminal.say(
    "  pnpm lintel addons link <this folder>   (from your Lintel folder) to try it in your site",
  );
  return folder;
}
