import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { findIllustration } from "@lintel/builder-model";
import { STYLESHEET_FOLDER } from "./site-context.service.js";

/**
 * The website's two kinds of files besides pages and the stylesheet: the motion runtime
 * (only pages with animations load it) and the illustrations the starter sites and the
 * section library use. Both are served from `/_lintel`, with fingerprints or long caching.
 */

export interface SiteScript {
  code: string;
  /** The address it is served at, which changes with its contents. */
  path: string;
}

let motionRuntime: SiteScript | null | undefined;

/** The built motion runtime, read once. Null if `@lintel/motion` hasn't been built. */
export function readMotionRuntime(): SiteScript | null {
  if (motionRuntime !== undefined) {
    return motionRuntime;
  }
  try {
    const file = createRequire(import.meta.url).resolve("@lintel/motion/site-runtime.js");
    const code = readFileSync(file, "utf8");
    const fingerprint = createHash("sha256").update(code).digest("hex").slice(0, 12);
    motionRuntime = { code, path: `${STYLESHEET_FOLDER}/motion-${fingerprint}.js` };
  } catch {
    motionRuntime = null;
  }
  return motionRuntime;
}

export const ILLUSTRATIONS_FOLDER = `${STYLESHEET_FOLDER}/illustrations`;

/** An illustration by its file name ("bakery-loaf.svg"), or undefined. */
export function readIllustration(fileName: string): string | undefined {
  const name = /^([a-z0-9-]+)\.svg$/.exec(fileName)?.[1];
  return name ? findIllustration(name) : undefined;
}
