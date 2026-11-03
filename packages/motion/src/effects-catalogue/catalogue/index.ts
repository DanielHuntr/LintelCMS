import type { EffectDefinition } from "../effect-definition.js";
import { canvasEffects } from "./canvas-effects.js";
import { cursorEffects, pointerFieldEffects } from "./cursor-effects.js";
import { depthEffects } from "./depth-effects.js";
import { hoverEffects } from "./hover-effects.js";
import { loaderEffects } from "./loader-effects.js";
import { marqueeEffects } from "./marquee-effects.js";
import { physicsEffects } from "./physics-effects.js";
import { scrollEffects } from "./scroll-effects.js";
import { svgEffects } from "./svg-effects.js";
import { textEffects } from "./text-effects.js";
import { transitionEffects } from "./transition-effects.js";

/** Every effect that comes with Lintel, in the order the gallery lists them. */
export const standardEffects: readonly EffectDefinition[] = [
  ...hoverEffects,
  ...textEffects,
  ...scrollEffects,
  ...depthEffects,
  ...canvasEffects,
  ...physicsEffects,
  ...svgEffects,
  ...cursorEffects,
  ...marqueeEffects,
  ...loaderEffects,
  ...transitionEffects,
  ...pointerFieldEffects,
] as readonly EffectDefinition[];
