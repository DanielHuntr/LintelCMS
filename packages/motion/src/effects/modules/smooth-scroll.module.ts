import { startSmoothScroll } from "../../smooth-scroll/smoothScroll.js";
import type { EffectBehaviour, EffectModule } from "../effect-types.js";
import { readText } from "../kit/params.js";

/**
 * Smooth scrolling for the whole site, switched on in the builder's site settings (see
 * `src/smooth-scroll`). The loader only starts it for a mouse or trackpad and for people
 * who haven't asked for less motion; touch screens keep their own scrolling.
 */
const siteSmoothScroll: EffectBehaviour = (_body, params, context) => {
  if (context.reduced || !context.finePointer) return;
  const strength = readText(params, "strength", "gentle") === "strong" ? "strong" : "gentle";
  const smooth = startSmoothScroll(window, { strength });
  return () => smooth.destroy();
};

export const behaviours = { siteSmoothScroll };
export default { behaviours } satisfies EffectModule;
