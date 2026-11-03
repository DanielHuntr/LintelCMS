import * as drizzle from "drizzle-orm";
import * as drizzlePostgres from "drizzle-orm/pg-core";
import * as zod from "zod";
import * as pluginApi from "../plugins/plugin-api.js";
import { ADDON_MODULES_GLOBAL, type SERVER_ADDON_MODULES } from "./addon-module-names.js";

/** Lintel's own copies of the modules add-ons' server bundles share (see addon-module-names.ts). */
const serverModules: Record<(typeof SERVER_ADDON_MODULES)[number], object> = {
  "@lintel/core/plugin": pluginApi,
  zod,
  "drizzle-orm": drizzle,
  "drizzle-orm/pg-core": drizzlePostgres,
};

/** Puts them where add-ons' bundles look, before the first add-on is imported. */
export function shareServerModules(): void {
  Object.assign(globalThis, { [ADDON_MODULES_GLOBAL]: serverModules });
}
