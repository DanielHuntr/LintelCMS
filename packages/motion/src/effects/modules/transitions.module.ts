import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { combine, listen } from "../kit/listen.js";
import { readNumber, readText } from "../kit/params.js";

/**
 * Page transitions. Browsers with cross-document view transitions run them from the CSS the
 * site writes into every page (see pageTransitionCss in @lintel/motion/effects): no script
 * at all, and elements given the same transition name morph from one page to the next.
 *
 * Everywhere else this is the fallback: a same-site link click plays the page's exit
 * animations and a short cover, then navigates; the next page uncovers itself on arrival.
 * New tabs, downloads, anchors on the same page and modified clicks are left alone.
 */

const coverKeyframes: Record<string, [Keyframe[], Keyframe[]]> = {
  fade: [
    [{ opacity: 0 }, { opacity: 1 }],
    [{ opacity: 1 }, { opacity: 0 }],
  ],
  slide: [
    [{ transform: "translateY(100%)" }, { transform: "translateY(0)" }],
    [{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }],
  ],
  wipe: [
    [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
    [{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 0 0 100%)" }],
  ],
  zoom: [
    [
      { opacity: 0, transform: "scale(1.08)" },
      { opacity: 1, transform: "scale(1)" },
    ],
    [{ opacity: 1 }, { opacity: 0 }],
  ],
};

const arrivalKey = "lintel-transition-arriving";

export function supportsCrossDocumentTransitions(): boolean {
  return typeof window !== "undefined" && "CSSViewTransitionRule" in window;
}

/** Whether a click on this link should get the transition rather than the browser's default. */
export function isTransitionableClick(
  event: MouseEvent,
  link: HTMLAnchorElement,
  here: Location,
): boolean {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return false;
  if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return false;
  const url = new URL(link.href, here.href);
  if (url.origin !== here.origin) return false;
  return !(url.pathname === here.pathname && url.search === here.search && url.hash !== "");
}

function cover(): HTMLDivElement {
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483646",
    background: "var(--lintel-color-background, #fff)",
    pointerEvents: "none",
  });
  document.body.append(layer);
  return layer;
}

const pageTransition: EffectBehaviour = (_body, params, context) => {
  if (supportsCrossDocumentTransitions()) return;
  const style = readText(params, "style", "fade");
  const duration = context.reduced ? 150 : readNumber(params, "duration", 450);
  const [enter, leave] = context.reduced
    ? coverKeyframes.fade!
    : (coverKeyframes[style] ?? coverKeyframes.fade!);
  try {
    if (sessionStorage.getItem(arrivalKey)) {
      sessionStorage.removeItem(arrivalKey);
      const layer = cover();
      void layer
        .animate(leave, { duration, easing: "cubic-bezier(.65,0,.35,1)", fill: "forwards" })
        .finished.then(() => layer.remove());
    }
  } catch {
    // Storage can be switched off; then pages simply arrive without the uncovering.
  }
  return combine(
    listen(document, {
      click: (event: MouseEvent) => {
        const link = (event.target as Element | null)?.closest?.("a[href]");
        if (!(link instanceof HTMLAnchorElement) || !isTransitionableClick(event, link, location))
          return;
        event.preventDefault();
        const exits =
          (
            window as Window & { lintelMotion?: { exitPage?: () => Promise<void> } }
          ).lintelMotion?.exitPage?.() ?? Promise.resolve();
        const covering = cover().animate(enter, {
          duration,
          easing: "cubic-bezier(.65,0,.35,1)",
          fill: "forwards",
        }).finished;
        void Promise.race([
          Promise.all([exits, covering]),
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]).then(() => {
          try {
            sessionStorage.setItem(arrivalKey, "1");
          } catch {
            // Without storage the next page just appears.
          }
          location.href = link.href;
        });
      },
    }),
    // Coming back with the back button can restore this page with the cover still on it.
    listen(window, {
      pageshow: (event: PageTransitionEvent) =>
        event.persisted &&
        document
          .querySelectorAll("body > div[aria-hidden='true'][style*='2147483646']")
          .forEach((layer) => layer.remove()),
    }),
  );
};

export const behaviours = { pageTransition };
export default { behaviours } satisfies EffectModule;
