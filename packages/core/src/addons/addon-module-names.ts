/**
 * The modules an add-on's bundle takes from Lintel instead of bringing its own copy, so it
 * shares Lintel's React, query cache, database helpers and plugin API. `lintel addons build`
 * leaves these out of the bundle; at run time the bundle reads them from
 * `globalThis[ADDON_MODULES_GLOBAL]`, which Lintel fills in before loading add-ons (the
 * server in addon-modules.ts, the admin in packages/admin/src/addons).
 *
 * Plain data with no imports, so the admin and the command line can read it too
 * (`@lintel/core/addon-modules`).
 */
export const ADDON_MODULES_GLOBAL = "__lintelAddonModules";

export const SERVER_ADDON_MODULES = [
  "@lintel/core/plugin",
  "zod",
  "drizzle-orm",
  "drizzle-orm/pg-core",
] as const;

export const ADMIN_ADDON_MODULES = [
  "react",
  "react/jsx-runtime",
  "react-dom",
  "@tanstack/react-query",
  "@lintel/admin/plugin",
] as const;
