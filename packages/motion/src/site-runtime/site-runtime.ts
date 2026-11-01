import { mountMotion } from "../runtime/mountMotion.js";
import {
  mountMotionList,
  type MotionBinding,
  type PageMotion,
} from "../runtime/mountMotionList.js";

/**
 * The script a published page loads when it has animations. It reads the page's animations
 * from `<script type="application/json" id="lintel-motion">` and starts them, and makes the
 * runtime available as `window.lintelMotion` (the builder's canvas uses that to preview an
 * animation on the element it belongs to). Pages without animations never load it.
 *
 * Built into one small file, `dist/site-runtime.js`, by scripts/bundle-site-runtime.mjs.
 */

export const motionDataElementId = "lintel-motion";

export interface SiteMotion {
  mountMotion: typeof mountMotion;
  mountMotionList: typeof mountMotionList;
}

declare global {
  interface Window {
    lintelMotion?: SiteMotion;
  }
}

/** The animations listed in the page, or none if the list is missing or unreadable. */
export function readPageAnimations(document: Document): MotionBinding[] {
  const element = document.getElementById(motionDataElementId);
  if (!element?.textContent) return [];
  try {
    const parsed: unknown = JSON.parse(element.textContent);
    return Array.isArray(parsed) ? (parsed as MotionBinding[]) : [];
  } catch {
    return [];
  }
}

export function startPageMotion(document: Document): PageMotion {
  return mountMotionList(readPageAnimations(document), { document });
}

export function installSiteRuntime(window: Window): void {
  window.lintelMotion = { mountMotion, mountMotionList };
  const start = () => startPageMotion(window.document);
  if (window.document.readyState === "loading") {
    window.document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}
