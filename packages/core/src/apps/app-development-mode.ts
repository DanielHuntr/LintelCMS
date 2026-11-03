import type { DatabaseOrTransaction } from "../database/client.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";
import type { SenderOptions } from "../webhooks/webhook-sender.js";
import { AppDevelopmentModeUnavailableError } from "./apps.errors.js";
import type { AppDevelopmentMode } from "./apps.schema.js";

/**
 * Apps' development mode: while it is on, an app running on this computer (localhost,
 * 127.0.0.1 or [::1]) can be installed, and its webhooks are delivered there. Nothing else
 * private is opened up, and other webhooks are unchanged, so it replaces
 * WEBHOOKS_ALLOW_PRIVATE_ADDRESSES while someone builds an app.
 *
 * Two things have to agree:
 * - the server allows it (`APPS_DEVELOPMENT_MODE`, which defaults to allowed only when
 *   Lintel runs in development), so a live site can't be switched into it from the admin;
 * - someone turned it on in Build → Apps, which shows a warning for as long as it is on.
 */
export interface AppDevelopmentOptions {
  /** Whether this server lets the switch be turned on at all. */
  available: boolean;
}

export async function readAppDevelopmentMode(
  database: DatabaseOrTransaction,
  options: AppDevelopmentOptions,
): Promise<AppDevelopmentMode> {
  const switchedOn = await readSetting(database, "appDevelopmentMode");
  return { available: options.available, on: options.available && switchedOn };
}

export async function setAppDevelopmentMode(
  database: DatabaseOrTransaction,
  on: boolean,
  options: AppDevelopmentOptions,
): Promise<AppDevelopmentMode> {
  if (on && !options.available) {
    throw new AppDevelopmentModeUnavailableError();
  }
  await writeSetting(database, "appDevelopmentMode", on);
  return readAppDevelopmentMode(database, options);
}

/** Whether apps may use this computer's addresses right now. */
export async function appsMayUseLoopback(
  database: DatabaseOrTransaction,
  options: AppDevelopmentOptions,
): Promise<boolean> {
  return (await readAppDevelopmentMode(database, options)).on;
}

/** The sender options for reading an app's manifest and checking its webhook addresses. */
export async function appSenderOptions(
  database: DatabaseOrTransaction,
  sender: SenderOptions,
  options: AppDevelopmentOptions,
): Promise<SenderOptions> {
  return (await appsMayUseLoopback(database, options))
    ? { ...sender, allowLoopbackAddresses: true }
    : sender;
}
