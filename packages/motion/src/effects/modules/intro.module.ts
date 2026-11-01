import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { combine, listen } from "../kit/listen.js";
import { readText } from "../kit/params.js";
import { addOverlay } from "../kit/styles.js";

/**
 * The site intro and section loaders.
 *
 * The intro's markup is written into the page by the server (see introMarkup in
 * @lintel/motion/effects), with CSS that hides it without scripts and after four seconds
 * whatever happens, so it can never trap anyone. This plays it once per visit: it counts or
 * reveals, then lifts away. "Skip intro", Escape or a click ends it at once.
 */

export const introSeenKey = "lintel-intro-seen";

function markSeen() {
  try {
    sessionStorage.setItem(introSeenKey, "1");
  } catch {
    // Without storage it may show again on the next page; the failsafe still hides it.
  }
}

const siteIntro: EffectBehaviour = (_body, params, context) => {
  const intro = document.querySelector<HTMLElement>(".lintel-intro");
  if (!intro) return;
  const seen = (() => {
    try {
      return sessionStorage.getItem(introSeenKey) === "1";
    } catch {
      return false;
    }
  })();
  if (seen) {
    intro.remove();
    return;
  }
  markSeen();
  intro.style.animation = "none";
  const counter = intro.querySelector<HTMLElement>(".lintel-intro__count");
  const style = readText(params, "style", "curtain");
  let finished = false;
  let timer = 0;
  const finish = () => {
    if (finished) return;
    finished = true;
    window.clearInterval(timer);
    const leaving = context.reduced
      ? [{ opacity: 1 }, { opacity: 0 }]
      : style === "curtain" || style === "name"
        ? [{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }]
        : [{ opacity: 1 }, { opacity: 0 }];
    void intro
      .animate(leaving, {
        duration: context.reduced ? 200 : 700,
        easing: "cubic-bezier(.76,0,.24,1)",
        fill: "forwards",
      })
      .finished.then(() => intro.remove());
  };
  const started = performance.now();
  const shortest = context.reduced ? 300 : 1300;
  if (counter) {
    timer = window.setInterval(() => {
      const share = Math.min(1, (performance.now() - started) / shortest);
      counter.textContent = `${Math.round(share * 100)}`;
    }, 32);
  }
  const whenLoaded =
    document.readyState === "complete"
      ? Promise.resolve()
      : new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
  const atLeast = new Promise((resolve) => setTimeout(resolve, shortest));
  const atMost = new Promise((resolve) => setTimeout(resolve, 3000));
  void Promise.race([Promise.all([whenLoaded, atLeast]), atMost]).then(finish);
  return combine(
    listen(intro, { click: finish }),
    listen(document, { keydown: (event: KeyboardEvent) => event.key === "Escape" && finish() }),
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

export const behaviours = { siteIntro, sectionLoader };
export default { behaviours } satisfies EffectModule;
