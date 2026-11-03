import { DataFolderInUseError, loadProjectEnvFile } from "@lintel/core/data-tools";
import {
  type ContentModel,
  type LiquidEditorSettings,
  hasContentModelFiles,
  initTemplatesFolder,
  liquidEditorSettings,
  readContentModelFiles,
  readContentModelFromDatabase,
  SnippetsFileUnreadableError,
  writeEditorSnippets,
} from "@lintel/core/liquid-editor-commands";
import { relative } from "node:path";
import { type Command, readArguments, withDatabase } from "../command.js";
import { CommandError, type Terminal } from "../terminal.js";

/**
 * Editor help for Liquid templates (see packages/core/src/liquid-editor-support):
 *
 *   init   the templates folder with a small working example, and VS Code snippets
 *   sync   the snippets again, for content types that changed
 *
 * The rules live in core; this reads the options and says what happened.
 */
const usage = [
  "Usage: pnpm lintel templates <init|sync>",
  "  init   make the templates folder with a working example, and VS Code snippets",
  "  sync   write the snippets for your content types' fields again",
].join("\n");

/** Where the fields come from: the content model files, else the database. */
export type ReadContentModel = (settings: LiquidEditorSettings) => Promise<ContentModel>;

const readContentModel: ReadContentModel = async (settings) =>
  hasContentModelFiles(settings)
    ? readContentModelFiles(settings)
    : withDatabase(({ database }) => readContentModelFromDatabase(database));

export function makeTemplatesCommand(
  readModel: ReadContentModel = readContentModel,
  settingsFor: () => LiquidEditorSettings = () => liquidEditorSettings(),
): Command {
  return {
    name: "templates",
    summary: "Liquid templates: a starting folder and VS Code snippets (init, sync)",
    usage,
    async run(argumentList, terminal) {
      const { positionals } = readArguments(argumentList, {}, usage);
      const [subcommand] = positionals;
      if (subcommand !== "init" && subcommand !== "sync") {
        throw new CommandError(usage);
      }
      loadProjectEnvFile();
      const settings = settingsFor();
      try {
        if (subcommand === "init") {
          await init(settings, readModel, terminal);
        } else {
          await sync(settings, readModel, terminal);
        }
      } catch (error) {
        if (error instanceof SnippetsFileUnreadableError) throw new CommandError(error.message);
        throw error;
      }
      return 0;
    },
  };
}

export const templatesCommand = makeTemplatesCommand();

async function init(
  settings: LiquidEditorSettings,
  readModel: ReadContentModel,
  terminal: Terminal,
): Promise<void> {
  const starter = await initTemplatesFolder(settings);
  for (const path of starter.written) terminal.say(`  wrote   ${shown(terminal, path)}`);
  for (const path of starter.kept)
    terminal.say(`  kept    ${shown(terminal, path)} (already there)`);

  let model: ContentModel | undefined;
  try {
    model = await readModel(settings);
  } catch (error) {
    if (!(error instanceof DataFolderInUseError)) throw error;
  }
  const snippets = await writeEditorSnippets(settings.snippetsFolder, model);
  for (const path of snippets.written) terminal.say(`  wrote   ${shown(terminal, path)}`);
  terminal.say();
  if (!model) {
    terminal.say(
      "Snippets for your own fields weren't written, because pnpm dev has the database open. " +
        "Restart pnpm dev and it writes them, or stop it and run `pnpm lintel templates sync`.",
    );
  }
  terminal.say(
    `Entries in a "pages" collection now use the example. Edit the files in ` +
      `${shown(terminal, settings.templatesFolder)}; while pnpm dev runs, a reload shows each change.`,
  );
}

async function sync(
  settings: LiquidEditorSettings,
  readModel: ReadContentModel,
  terminal: Terminal,
): Promise<void> {
  let model: ContentModel;
  try {
    model = await readModel(settings);
  } catch (error) {
    if (error instanceof DataFolderInUseError) {
      throw new CommandError(
        "pnpm dev has the database open, and while it runs it keeps these snippets up to date " +
          "itself. There's nothing to do.",
      );
    }
    throw error;
  }
  const result = await writeEditorSnippets(settings.snippetsFolder, model);
  for (const path of result.written) terminal.say(`  wrote   ${shown(terminal, path)}`);
  terminal.say(
    result.written.length === 0
      ? `The snippets were already up to date (${result.fieldCount} fields).`
      : `Snippets for ${result.fieldCount} fields are ready.`,
  );
}

/** Paths relative to where the person ran the command, when they are inside it. */
function shown(terminal: Terminal, path: string): string {
  const fromHere = relative(terminal.workingFolder, path);
  return fromHere.startsWith("..") ? path : fromHere.split("\\").join("/");
}
