import type * as LottiePlayerFile from "../players/lottie-player.js";
import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { combine, listen } from "../kit/listen.js";
import { loadLottieData } from "../kit/lottie-file.js";
import {
  addStage,
  animationAddress,
  followScroll,
  hasPoster,
  importPlayer,
  readPlayWhen,
  watchOnScreen,
} from "../kit/media-player.js";
import { readSwitch, readText } from "../kit/params.js";

/**
 * The Lottie element: plays a Lottie animation (.json or .lottie) from the media library.
 * The player is lottie-web's light build (MIT), which draws SVG and never runs code from the
 * file; it is a separate file this module fetches only when a Lottie comes near the screen.
 *
 * It plays when the page opens, when it comes into view, while the pointer is over it, or
 * in step with scrolling. It rests while off screen. Until it is ready, and for people who
 * ask for less motion, the element shows its poster, or else one still frame.
 */

const lottiePlayer: EffectBehaviour = (element, params, context) => {
  if (context.reduced && hasPoster(element)) return;
  const playWhen = readPlayWhen(readText(params, "play", "view"));
  const loop = readSwitch(params, "loop", true);
  const address = animationAddress(readText(params, "src", ""), "sample-hop.json");
  const { stage, showStage, remove } = addStage(element, "div");
  let stopped = false;
  const stops: Array<() => void> = [];

  void Promise.all([
    importPlayer<typeof LottiePlayerFile>("lottie-player.js"),
    loadLottieData(address),
  ])
    .then(([player, data]) => {
      if (stopped) return;
      const lottie = player.default;
      const animation = lottie.loadAnimation({
        container: stage,
        renderer: "svg",
        loop: playWhen === "load" || playWhen === "view" ? loop : false,
        autoplay: false,
        animationData: data,
        rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
      });
      stops.push(() => animation.destroy());
      const lastFrame = () => Math.max(0, animation.totalFrames - 1);
      animation.addEventListener("DOMLoaded", () => {
        if (stopped) return;
        showStage();
        if (context.reduced) {
          animation.goToAndStop(Math.round(lastFrame() / 2), true);
          return;
        }
        if (playWhen === "scroll") {
          stops.push(
            followScroll(element, (progress) =>
              animation.goToAndStop(progress * lastFrame(), true),
            ),
          );
          return;
        }
        if (playWhen === "hover") {
          const forwards = () => (animation.setDirection(1), animation.play());
          const backwards = () => (animation.setDirection(-1), animation.play());
          stops.push(
            listen(element, {
              pointerenter: forwards,
              pointerleave: backwards,
              focusin: forwards,
              focusout: backwards,
            }),
          );
          return;
        }
        // On load or in view: play while on screen. Played once (no loop), it stays finished.
        // "load" starts at once; "view" waits until it is seen. Both rest while off screen.
        let finished = false;
        animation.addEventListener("complete", () => (finished = true));
        if (playWhen === "load") animation.play();
        stops.push(
          watchOnScreen(element, (visible) => {
            if (finished) return;
            if (visible) animation.play();
            else animation.pause();
          }),
        );
      });
    })
    // A missing or broken file leaves the poster (or the empty frame) in place.
    .catch(() => undefined);

  return combine(() => {
    stopped = true;
    stops.splice(0).forEach((stop) => stop());
    remove();
  });
};

export const behaviours: EffectModule["behaviours"] = { lottiePlayer };
