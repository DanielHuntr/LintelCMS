import { attentionPresets } from "./attentionPresets.js";
import { entrancePresets } from "./entrancePresets.js";
import { hoverPresets } from "./hoverPresets.js";
import type { MotionPreset, PresetCategory } from "./preset.js";
import { scrollPresets } from "./scrollPresets.js";
import { retiredPagePresets, transitionPresets } from "./transitionPresets.js";

/**
 * Every ready-made animation, in the order the gallery shows them.
 */
export const motionPresets: readonly MotionPreset[] = [
  ...entrancePresets,
  ...scrollPresets,
  ...hoverPresets,
  ...attentionPresets,
  ...transitionPresets,
];

/** Finds any preset by id, including retired ones that saved designs may still name. */
export function findPreset(id: string): MotionPreset | undefined {
  return [...motionPresets, ...retiredPagePresets].find((preset) => preset.id === id);
}

export function presetsIn(category: PresetCategory): MotionPreset[] {
  return motionPresets.filter((preset) => preset.category === category);
}

export { presetCategories, definePreset, fromTo, through } from "./preset.js";
export type { MotionPreset, PresetCategory, PreviewSample } from "./preset.js";
