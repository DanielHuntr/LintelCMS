import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { combine, listen } from "../kit/listen.js";
import { readNumber, readText } from "../kit/params.js";
import { addOverlay } from "../kit/styles.js";
import {
  INTRO_LONGEST_MILLISECONDS,
  INTRO_SHORTEST_MILLISECONDS,
  introCount,
  introLeavingKeyframes,
} from "../../effects-catalogue/site-intro.js";

/**
 * The site intro and section loaders.
 *
 * The intro's markup is written into the home page by the server (see introMarkup in
 * @lintel/motion/effects), with CSS that shows it only with scripts on and for people happy
 * with motion, and hides it after four seconds whatever happens, so it can never trap
 * anyone. This plays it once per visit: it counts or reveals, then lifts away. "Skip intro",
 * a click or any key ends it at once.
 */

export const introSeenKey = "lintel-intro-seen";

function markSeen() {
  try {
    sessionStorage.setItem(introSeenKey, "1");
  } catch {
    // Without storage it may show again on the next page; the failsafe still hides it.
  }
}

function seenThisVisit(): boolean {
  try {
    return sessionStorage.getItem(introSeenKey) === "1";
  } catch {
    return false;
  }
}

const siteIntro: EffectBehaviour = (_body, params, context) => {
  const intro = document.querySelector<HTMLElement>(".lintel-intro");
  if (!intro) return;
  // Less motion means no intro at all (its CSS never shows it either).
  if (seenThisVisit() || context.reduced) {
    intro.remove();
    return;
  }
  markSeen();
  intro.style.animation = "none";
  const counter = intro.querySelector<HTMLElement>(".lintel-intro__count");
  const style = readText(params, "style", "counter");
  let finished = false;
  let timer = 0;
  const finish = () => {
    if (finished) return;
    finished = true;
    window.clearInterval(timer);
    void intro
      .animate(
        [
          ...(introLeavingKeyframes[style as keyof typeof introLeavingKeyframes] ??
            introLeavingKeyframes.logo),
        ] as Keyframe[],
        {
          duration: 700,
          easing: "cubic-bezier(.76,0,.24,1)",
          fill: "forwards",
        },
      )
      .finished.then(() => intro.remove());
  };
  const started = performance.now();
  if (counter) {
    timer = window.setInterval(() => {
      counter.textContent = `${introCount((performance.now() - started) / INTRO_SHORTEST_MILLISECONDS)}`;
    }, 32);
  }
  const whenLoaded =
    document.readyState === "complete"
      ? Promise.resolve()
      : new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
  const atLeast = new Promise((resolve) => setTimeout(resolve, INTRO_SHORTEST_MILLISECONDS));
  const atMost = new Promise((resolve) => setTimeout(resolve, INTRO_LONGEST_MILLISECONDS));
  void Promise.race([Promise.all([whenLoaded, atLeast]), atMost]).then(finish);
  return combine(
    listen(intro, { click: finish }),
    // Any key skips it, except Tab, which moves to the Skip button.
    listen(document, { keydown: (event: KeyboardEvent) => event.key !== "Tab" && finish() }),
    () => window.clearInterval(timer),
  );
};

/**
 * A soft shimmer over a section until its pictures have loaded, then it fades away. Nothing
 * is hidden underneath, so it never delays reading.
 */
const sectionLoader: EffectBehaviour = (element, _params, context) => {
  const pictures = Array.from(element.querySelectorAll("img")).filter((image) => !image.complete);
  if (pictures.length === 0) return;
  const layer = addOverlay(element);
  layer.overlay.style.background =
    "linear-gradient(100deg, transparent 30%, rgb(255 255 255 / 0.45) 50%, transparent 70%) 0 0 / 300% 100%, rgb(127 127 127 / 0.08)";
  const shimmer = context.reduced
    ? undefined
    : layer.overlay.animate(
        [{ backgroundPosition: "100% 0, 0 0" }, { backgroundPosition: "-50% 0, 0 0" }],
        { duration: 1200, iterations: Infinity },
      );
  void Promise.all(
    pictures.map(
      (image) =>
        new Promise(
          (resolve) => (
            image.addEventListener("load", resolve, { once: true }),
            image.addEventListener("error", resolve, { once: true })
          ),
        ),
    ),
  ).then(() => {
    void layer.overlay
      .animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" })
      .finished.then(layer.remove);
  });
  return () => {
    shimmer?.cancel();
    layer.remove();
  };
};

/**
 * A notification that slides in after a moment, waits, then leaves by itself. It is a
 * polite live region, so screen readers announce it without interrupting; its close button
 * (any button inside) dismisses it, and the timer pauses while the pointer or focus is on it.
 */
const toast: EffectBehaviour = (element, params, context) => {
  const delay = readNumber(params, "delay", 1.5) * 1000;
  const stay = readNumber(params, "stay", 6) * 1000;
  const from = readText(params, "from", "bottom") === "top" ? "-120%" : "120%";
  const hidden = { opacity: 0, transform: `translateY(${context.reduced ? "0" : from})` };
  const shown = { opacity: 1, transform: "translateY(0)" };
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");
  element.style.opacity = "0";
  element.style.visibility = "hidden";
  let leaveTimer = 0;
  let paused = false;
  const leave = () => {
    void element
      .animate([shown, hidden], { duration: 300, easing: "ease-in", fill: "forwards" })
      .finished.then(() => (element.style.visibility = "hidden"));
  };
  const scheduleLeave = () => {
    window.clearTimeout(leaveTimer);
    if (stay > 0 && !paused) leaveTimer = window.setTimeout(leave, stay);
  };
  const enterTimer = window.setTimeout(() => {
    element.style.visibility = "visible";
    element.animate([hidden, shown], {
      duration: context.reduced ? 200 : 500,
      easing: "cubic-bezier(.2,.8,.2,1)",
      fill: "forwards",
    });
    scheduleLeave();
  }, delay);
  return combine(
    listen(element, {
      click: (event: MouseEvent) =>
        (event.target as Element).closest("button") && (window.clearTimeout(leaveTimer), leave()),
      pointerenter: () => ((paused = true), window.clearTimeout(leaveTimer)),
      pointerleave: () => ((paused = false), scheduleLeave()),
      focusin: () => ((paused = true), window.clearTimeout(leaveTimer)),
      focusout: () => ((paused = false), scheduleLeave()),
    }),
    () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(leaveTimer);
      element.getAnimations().forEach((animation) => animation.cancel());
      element.style.removeProperty("opacity");
      element.style.removeProperty("visibility");
    },
  );
};

export const behaviours = { siteIntro, sectionLoader, toast };
export default { behaviours } satisfies EffectModule;
