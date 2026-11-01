import { HttpError } from "../http/http-errors.js";

/** A plugin's endpoints answer this while the plugin is switched off. */
export class PluginNotEnabledError extends HttpError {
  constructor(pluginName: string) {
    super(
      404,
      "PLUGIN_NOT_ENABLED",
      `“${pluginName}” is switched off. An admin can switch it on in Settings → Features.`,
    );
  }
}

/** Someone asked to switch on (or set up) a plugin that isn't installed. */
export class UnknownPluginError extends HttpError {
  constructor(unknownIds: readonly string[], knownIds: readonly string[]) {
    const names = unknownIds.map((id) => `"${id}"`).join(", ");
    super(
      400,
      "INVALID_REQUEST",
      `There is no plugin called ${names}. The plugins are: ${knownIds.join(", ")}`,
    );
  }
}

export class PluginNotFoundError extends HttpError {
  constructor(pluginId: string) {
    super(404, "NOT_FOUND", `There is no plugin called "${pluginId}".`);
  }
}

export class PluginHasNoSettingsError extends HttpError {
  constructor(pluginName: string) {
    super(404, "NOT_FOUND", `${pluginName} has no settings.`);
  }
}

/**
 * A plugin that can't be installed as written, found when the server starts. This is a
 * mistake in the plugin's code, so the message is for its developer.
 */
export class InvalidPluginError extends Error {
  constructor(pluginId: string, problem: string) {
    super(`The plugin "${pluginId}" can't be installed: ${problem}`);
    this.name = "InvalidPluginError";
  }
}
