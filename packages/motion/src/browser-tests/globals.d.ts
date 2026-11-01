import type * as motion from "../index.js";
import type * as presets from "../presets/index.js";

/** What harness.ts puts on the test page's window. */
declare global {
  interface Window {
    motion: typeof motion;
    presets: typeof presets;
  }
}
