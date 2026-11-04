/**
 * Rive's official web runtime, the lite build (MIT). Bundled on its own and fetched by the
 * Rive module only when a page has a Rive near the screen; its WebAssembly sits beside it.
 */
import { Rive } from "@rive-app/canvas-lite";

// Notes to developers about Rive's next version: visitors' consoles aren't the place for them.
Rive.suppressDeprecationWarnings = ["default-state-machine", "state-machine-inputs"];

export { Alignment, Fit, Layout, RuntimeLoader } from "@rive-app/canvas-lite";
export { Rive };
