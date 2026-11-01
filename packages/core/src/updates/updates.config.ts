import { z } from "zod";
import { optionalSetting, yesOrNoSetting } from "../config-values.js";
import { type InstallType, installTypes } from "./updates.schema.js";
import type { UpdatesOptions } from "./updates-runtime.js";

/**
 * How Lintel looks for and installs updates. Part of the one config schema in
 * src/config.ts. With nothing set, Lintel asks GitHub for its releases once a day.
 */
export const updateSettings = {
  // Where to look for new versions: GitHub's releases API, or an agency's own feed.
  UPDATE_FEED_URL: optionalSetting(z.url({ error: "Should be a web address" })),
  // "off" stops every check, for sites that can't or mustn't reach the internet.
  UPDATE_CHECKS: yesOrNoSetting(true),
  // A minisign public key that replaces Lintel's own, for agencies who sign their builds.
  UPDATE_PUBLIC_KEY: optionalSetting(z.string().trim().min(1)),
  // How this copy was installed, when Lintel can't tell by itself.
  LINTEL_INSTALL_TYPE: optionalSetting(
    z.enum(installTypes, { error: `Should be one of ${installTypes.join(", ")}` }),
  ),
  // The opt-in lintel-updater service for Docker (deploy/docker-compose.yml) and its token.
  LINTEL_UPDATER_URL: optionalSetting(z.url({ error: "Should be a web address" })),
  LINTEL_UPDATER_TOKEN: optionalSetting(
    z.string().min(32, { error: "Use at least 32 characters" }),
  ),
};

interface UpdateSettingValues {
  UPDATE_FEED_URL?: string | undefined;
  UPDATE_CHECKS: boolean;
  UPDATE_PUBLIC_KEY?: string | undefined;
  LINTEL_INSTALL_TYPE?: InstallType | undefined;
  LINTEL_UPDATER_URL?: string | undefined;
  LINTEL_UPDATER_TOKEN?: string | undefined;
}

/** The settings above, as buildServer's `updates` option. */
export function updatesOptionsFromConfig(config: UpdateSettingValues): UpdatesOptions {
  return {
    checksEnabled: config.UPDATE_CHECKS,
    feedUrl: config.UPDATE_FEED_URL,
    publicKey: config.UPDATE_PUBLIC_KEY,
    installType: config.LINTEL_INSTALL_TYPE,
    dockerUpdater:
      config.LINTEL_UPDATER_URL && config.LINTEL_UPDATER_TOKEN
        ? { url: config.LINTEL_UPDATER_URL, token: config.LINTEL_UPDATER_TOKEN }
        : null,
  };
}
