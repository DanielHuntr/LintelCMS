import { mountMotion } from "../runtime/mountMotion.js";
import {
  mountEffect,
  registerEffectBehaviour,
  setEffectModuleAddresses,
  startEffects,
} from "../effects/loadEffects.js";
import type { PageEffects } from "../effects/effect-types.js";
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
 * Effects (`<script type="application/json" id="lintel-effects">`) start the same way; their
 * modules are imported only when an element using them comes near the screen.
 *
 * Built into one small file, `dist/site-runtime.js`, by scripts/bundle-site-runtime.mjs.
 */

export const motionDataElementId = "lintel-motion";
export const effectsDataElementId = "lintel-effects";

export interface SiteMotion {
  mountMotion: typeof mountMotion;
  mountMotionList: typeof mountMotionList;
  mountEffect: typeof mountEffect;
  registerEffectBehaviour: typeof registerEffectBehaviour;
  setEffectModuleAddresses: typeof setEffectModuleAddresses;
  /** Plays the page's exit animations; page transitions wait for it before navigating. */
  exitPage?: () => Promise<void>;
}

declare global {
  interface Window {
    lintelMotion?: SiteMotion;
  }
}

function readJson(document: Document, id: string): unknown {
  const element = document.getElementById(id);
  if (!element?.textContent) return undefined;
  try {
    return JSON.parse(element.textContent) as unknown;
  } catch {
    return undefined;
  }
}

/** The animations listed in the page, or none if the list is missing or unreadable. */
export function readPageAnimations(document: Document): MotionBinding[] {
  const parsed = readJson(document, motionDataElementId);
  return Array.isArray(parsed) ? (parsed as MotionBinding[]) : [];
}

/** The page's effects, or none if the list is missing or unreadable. */
export function readPageEffects(document: Document): PageEffects {
  const parsed = readJson(document, effectsDataElementId) as Partial<PageEffects> | undefined;
  return {
    modules: parsed?.modules ?? {},
    bindings: Array.isArray(parsed?.bindings) ? parsed.bindings : [],
    site: parsed?.site,
  };
}

export function startPageMotion(document: Document): PageMotion {
  return mountMotionList(readPageAnimations(document), { document });
}

export function installSiteRuntime(window: Window): void {
  window.lintelMotion = {
    mountMotion,
    mountMotionList,
    mountEffect,
    registerEffectBehaviour,
    setEffectModuleAddresses,
  };
  const start = () => {
    const page = startPageMotion(window.document);
    if (window.lintelMotion) window.lintelMotion.exitPage = () => page.exitPage();
    startEffects(window.document, readPageEffects(window.document));
  };
  if (window.document.readyState === "loading") {
    window.document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}
