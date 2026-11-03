import {
  findPluginCommand,
  type LintelPlugin,
  lintelPaths,
  listPluginCommands,
  loadConfig,
  loadInstalledPlugins,
  loadProjectEnvFile,
  loadSiteAddons,
  runPluginCommand,
} from "@lintel/core/data-tools";
import { withDatabase } from "../command.js";
import { CommandError, formatTable, type Terminal } from "../terminal.js";

/**
 * Commands plugins add, run as `lintel <plugin id>:<name>` (see
 * packages/core/src/plugins/plugin-commands.ts). They come from the plugins in
 * lintel.config.ts and the site's add-ons; an add-on that can't load has none.
 */

export type LoadPlugins = () => Promise<LintelPlugin[]>;

export const loadCommandPlugins: LoadPlugins = async () => {
  loadProjectEnvFile();
  const configPlugins = await loadInstalledPlugins();
  const addons = await loadSiteAddons(lintelPaths(loadConfig()).root, configPlugins);
  return [...configPlugins, ...addons.loaded.map((addon) => addon.plugin)];
};

export async function runAddonCommand(
  fullName: string,
  commandArguments: readonly string[],
  terminal: Terminal,
  loadPlugins: LoadPlugins = loadCommandPlugins,
): Promise<number> {
  const plugins = await loadPlugins();
  const found = findPluginCommand(plugins, fullName);
  if (!found) {
    throw new CommandError(
      `There is no "${fullName}" command. Add-ons' commands are listed by lintel help.`,
    );
  }
  if (commandArguments.includes("--help") || commandArguments.includes("-h")) {
    terminal.say(found.command.description);
    if (found.command.usage) terminal.say(found.command.usage);
    return 0;
  }
  return withDatabase(async (activeDatabase) => {
    // The add-on's own tables, as the server would bring them up to date when it starts.
    await activeDatabase.applyPluginMigrations(
      plugins.flatMap((plugin) =>
        plugin.database
          ? [{ pluginId: plugin.id, migrationsFolder: plugin.database.migrationsFolder }]
          : [],
      ),
    );
    return runPluginCommand(found.plugin, found.command, {
      arguments: commandArguments,
      database: activeDatabase.database,
      say: (text) => terminal.say(text),
    });
  });
}

/** The "Add-on commands" part of `lintel help`; nothing when there are none. */
export async function printAddonCommands(
  terminal: Terminal,
  loadPlugins: LoadPlugins = loadCommandPlugins,
): Promise<void> {
  let commands: ReturnType<typeof listPluginCommands>;
  try {
    commands = listPluginCommands(await loadPlugins());
  } catch {
    // Help should always work, even when an add-on doesn't.
    return;
  }
  if (commands.length === 0) return;
  terminal.say();
  terminal.say("Add-on commands:");
  terminal.say();
  for (const line of formatTable(
    commands.map(({ fullName, description }) => [fullName, description]),
  )) {
    terminal.say(`  ${line}`);
  }
}
