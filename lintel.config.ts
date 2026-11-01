import type { LintelConfig } from "@lintel/core";

/**
 * The plugin packages this site installs, besides the ones built into Lintel. Install a
 * package at the repository root (`pnpm add -w <package>`), add its name here and restart
 * `pnpm dev`. Each one still has to be switched on in Settings → Features.
 *
 * The Bookings example is here so developers can see a working plugin; take it out for a
 * real site.
 */
export default {
  plugins: ["@lintel/plugin-example-bookings"],
} satisfies LintelConfig;
