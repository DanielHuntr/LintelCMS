import {
  motionSpecSchema,
  type MotionSpec,
  type MotionSpecInput,
  type Track,
} from "../spec/motion.schema.js";

/**
 * A ready-made animation: a spec plus the words and preview the gallery shows.
 * Presets are checked against the schema when this module loads, so a broken preset
 * fails the tests instead of a page.
 */

export const presetCategories = ["entrance", "scroll", "hover", "attention", "transition"] as const;
export type PresetCategory = (typeof presetCategories)[number];

/**
 * The sample element a preview animates. Each is drawn by the editor's gallery; a preset
 * picks the one that shows it best (split text needs a heading, a stagger needs a list).
 */
export type PreviewSample =
  "card" | "heading" | "button" | "image" | "list" | "link" | "progress" | "panels" | "page";

export interface MotionPreset {
  id: string;
  name: string;
  /** One or two plain sentences: what it does and when to use it. */
  description: string;
  category: PresetCategory;
  preview: { sample: PreviewSample };
  spec: MotionSpec;
}

export function definePreset(
  preset: Omit<MotionPreset, "spec"> & { spec: MotionSpecInput },
): MotionPreset {
  return { ...preset, spec: motionSpecSchema.parse(preset.spec) };
}

type Value = number | string;

/** A two-keyframe track: from one value to another. */
export function fromTo(property: Track["property"], from: Value, to: Value): Track {
  return {
    property,
    keyframes: [
      { offset: 0, value: from },
      { offset: 1, value: to },
    ],
  };
}

/** A track through several values spaced evenly in time. */
export function through(property: Track["property"], values: readonly Value[]): Track {
  return {
    property,
    keyframes: values.map((value, index) => ({ offset: index / (values.length - 1), value })),
  };
}
