import * as reactQuery from "@tanstack/react-query";
import type { ADMIN_ADDON_MODULES } from "@lintel/core/addon-modules";
import * as react from "react";
import * as reactDom from "react-dom";
import * as jsxRuntime from "react/jsx-runtime";
import * as pluginApi from "../plugins/plugin-api.js";

/**
 * The admin's own copies of the modules add-ons share instead of bundling (see
 * addon-module-names.ts in core): one React, one query cache, one design system. An
 * add-on's bundle reads them from `globalThis.__lintelAddonModules`.
 */
export const sharedAddonModules: Record<(typeof ADMIN_ADDON_MODULES)[number], object> = {
  react,
  "react/jsx-runtime": jsxRuntime,
  "react-dom": reactDom,
  "@tanstack/react-query": reactQuery,
  "@lintel/admin/plugin": pluginApi,
};
