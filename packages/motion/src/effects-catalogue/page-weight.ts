import type { EffectModuleName, SiteEffectSettings } from "../effects/effect-types.js";
import type { EffectDefinition } from "./effect-definition.js";
import { effectModuleBytes, effectPlayerBytes } from "./module-sizes.js";
import { cursorIsOn } from "../effects/kit/cursor-look.js";

/**
 * What a page's effects cost, for the builder's meter ("3 effects, adds 14 kB") and its
 * warnings about heavy combinations. Each module is counted once, however many elements
 * use it, since the browser downloads it once.
 */

export type PageWeightWarning =
  | "severalShaderEffects"
  | "manyEffects"
  | "manyPointerEffects"
  | "heavyDownload"
  | "cursorAndTrails";

export interface PageWeight {
  effectCount: number;
  modules: EffectModuleName[];
  /** Gzipped bytes the effects add to the page. */
  bytes: number;
  warnings: PageWeightWarning[];
}

const shaderModules: readonly EffectModuleName[] = [
  "liquid-gradient",
  "image-distort",
  "ripple",
  "shader-backgrounds",
  "shader-stack",
  "picture-effects",
];

export function measurePageWeight(
  effects: readonly EffectDefinition[],
  site?: SiteEffectSettings,
): PageWeight {
  const modules = new Set<EffectModuleName>();
  for (const effect of effects) {
    if (effect.kind === "behaviour" && effect.module !== "custom") modules.add(effect.module);
  }
  if (cursorIsOn(site?.cursor)) modules.add("cursor");
  if (site?.pageTransition.style && site.pageTransition.style !== "none")
    modules.add("transitions");
  if (site?.intro.style && site.intro.style !== "none") modules.add("intro");
  if (site?.smoothScroll?.strength && site.smoothScroll.strength !== "off")
    modules.add("smooth-scroll");
  const list = [...modules].sort();
  const bytes = list.reduce(
    (total, name) => total + effectModuleBytes[name] + (effectPlayerBytes[name] ?? 0),
    0,
  );
  const warnings: PageWeightWarning[] = [];
  const shaders = effects.filter(
    (effect) =>
      effect.kind === "behaviour" && shaderModules.includes(effect.module as EffectModuleName),
  );
  if (shaders.length > 2) warnings.push("severalShaderEffects");
  if (effects.length > 12) warnings.push("manyEffects");
  if (effects.filter((effect) => effect.category === "hover").length > 8)
    warnings.push("manyPointerEffects");
  if (bytes > 40 * 1024) warnings.push("heavyDownload");
  if (
    site?.cursor.style !== undefined &&
    site.cursor.style !== "none" &&
    effects.some((effect) => effect.category === "cursor" && effect.listed !== false)
  ) {
    warnings.push("cursorAndTrails");
  }
  return { effectCount: effects.length, modules: list, bytes, warnings };
}
