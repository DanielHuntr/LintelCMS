import type { DatabaseOrTransaction } from "../database/client.js";
import { createPluginContext, type PluginContext, type PluginLog } from "./plugin-context.js";
import type { LintelPlugin } from "./plugin-definition.js";

/** What a plugin's terminal command is given, besides the plugin's usual context. */
export interface PluginCommandContext<Settings = unknown> extends PluginContext<Settings> {
  /** The words after the command's name: `lintel bookings:export march` gives ["march"]. */
  arguments: readonly string[];
  /** Prints a line for the person at the terminal. */
  say(text: string): void;
}

/**
 * A terminal command: `lintel <plugin id>:<name>`. It runs with the site's database open
 * (and its tables up to date), whether or not the plugin is switched on, so a command can
 * prepare things before the plugin is used.
 */
export interface PluginCommand<Settings = unknown> {
  /** Lowercase letters, numbers and dashes: "export". */
  name: string;
  /** One plain sentence, for `lintel help`. */
  description: string;
  /** Shown with --help, such as "lintel bookings:export [month]". Optional. */
  usage?: string;
  /** Returns the exit code, or nothing for 0. */
  run(context: PluginCommandContext<Settings>): Promise<number | void>;
}

/** A plugin's command found by its full name, "bookings:export"; undefined when there's none. */
export function findPluginCommand(
  plugins: readonly LintelPlugin[],
  fullName: string,
): { plugin: LintelPlugin; command: PluginCommand } | undefined {
  const separator = fullName.indexOf(":");
  if (separator < 1) return undefined;
  const plugin = plugins.find((candidate) => candidate.id === fullName.slice(0, separator));
  const command = plugin?.commands?.find(({ name }) => name === fullName.slice(separator + 1));
  return plugin && command ? { plugin, command } : undefined;
}

/** Every plugin command as "<id>:<name>" with its description, for `lintel help`. */
export function listPluginCommands(
  plugins: readonly LintelPlugin[],
): Array<{ fullName: string; description: string; usage: string | undefined }> {
  return plugins.flatMap((plugin) =>
    (plugin.commands ?? []).map((command) => ({
      fullName: `${plugin.id}:${command.name}`,
      description: command.description,
      usage: command.usage,
    })),
  );
}

/** Runs a plugin's command with the site's database; gives back its exit code. */
export async function runPluginCommand(
  plugin: LintelPlugin,
  command: PluginCommand,
  input: {
    arguments: readonly string[];
    database: DatabaseOrTransaction;
    say: (text: string) => void;
  },
): Promise<number> {
  const log: PluginLog = {
    info: (message) => input.say(message),
    error: (message, error) =>
      input.say(error instanceof Error ? `${message}: ${error.message}` : message),
  };
  const exitCode = await command.run({
    ...createPluginContext(plugin, input.database, log),
    arguments: input.arguments,
    say: input.say,
  });
  return exitCode ?? 0;
}
