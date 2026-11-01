import { writeExport } from "@lintel/core/data-tools";
import { type Command, defaultStorage, readArguments, withDatabase } from "../command.js";
import { plural, resolvePath } from "../terminal.js";

/**
 * Exports content types, entries, taxonomies, globals, menus and media as a Lintel export,
 * for moving content to another Lintel. Users, settings and secrets stay behind; use
 * `lintel backup` to copy a whole site.
 */
const usage = "Usage: pnpm lintel export [--output <file>] [--revisions] [--no-files]";

export const exportCommand: Command = {
  name: "export",
  summary: "Export content and media as portable JSON (a .zip with the files)",
  usage,
  async run(argumentList, terminal) {
    const { values } = readArguments(
      argumentList,
      {
        output: { type: "string", short: "o" },
        revisions: { type: "boolean" },
        "no-files": { type: "boolean" },
      },
      usage,
    );
    const includeFiles = !values["no-files"];
    const today = new Date().toISOString().slice(0, 10);
    const path = resolvePath(
      terminal,
      values.output ?? `lintel-export-${today}.${includeFiles ? "zip" : "json"}`,
    );

    return withDatabase(async (activeDatabase) => {
      const document = await writeExport(
        { database: activeDatabase.database, storage: defaultStorage() },
        path,
        { includeFiles, includeRevisions: values.revisions ?? false },
      );
      terminal.say(`Saved ${path}.`);
      terminal.say(
        `It has ${plural(document.entries.length, "entry", "entries")}, ` +
          `${plural(document.collections.length, "collection")}, ` +
          `${plural(document.taxonomies.length, "taxonomy", "taxonomies")}, ` +
          `${plural(document.globals.length, "global set")}, ` +
          `${plural(document.menus.length, "menu")} and ${plural(document.media.length, "media file")}` +
          `${includeFiles ? "" : " (details only, without the files)"}.`,
      );
      return 0;
    });
  },
};
