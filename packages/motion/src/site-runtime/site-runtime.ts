import { mountMotion } from "../runtime/mountMotion.js";
import {
  mountEffect,
  registerEffectBehaviour,
  setEffectModuleAddresses,
  startEffects,
} from "../effects/loadEffects.js";
import type { PageEffects } from "../effects/effect-types.js";
import { isTransitionableClick } from "../runtime/sameSiteClick.js";
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

/** Longest a visitor waits on a click for exit animations, however long they are set to run. */
const LONGEST_EXIT_WAIT_MILLISECONDS = 1500;

/**
 * Page-exit animations used to play only alongside a page transition, which was the one
 * thing that asked for them; on their own they never played (LINTEL-FUNC-020). Now a
 * same-site link click waits for them, then navigates.
 *
 * The listener is on the window, so a page transition (listening on the document) sees the
 * click first and, when there is one, plays the exits itself with its cover.
 */
export function playExitsBeforeLeaving(
  window: Window,
  page: Pick<PageMotion, "exitPage" | "resetPageExits">,
) {
  let leaving = false;
  window.addEventListener("click", (event) => {
    const link = (event.target as Element | null)?.closest?.("a[href]");
    if (leaving || !(link instanceof HTMLAnchorElement)) return;
    if (!isTransitionableClick(event, link, window.location)) return;
    event.preventDefault();
    leaving = true;
    void Promise.race([
      page.exitPage(),
      new Promise((resolve) => window.setTimeout(resolve, LONGEST_EXIT_WAIT_MILLISECONDS)),
    ]).then(() => {
      window.location.href = link.href;
    });
  });
  // Coming back with the back button can restore this page as it was left: faded out.
  window.addEventListener("pageshow", (event) => {
    leaving = false;
    if ((event as PageTransitionEvent).persisted) page.resetPageExits();
  });
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
    if (page.hasPageExits) playExitsBeforeLeaving(window, page);
    startEffects(window.document, readPageEffects(window.document));
  };
  if (window.document.readyState === "loading") {
    window.document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}
