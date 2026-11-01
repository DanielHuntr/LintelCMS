import type { MotionSpec } from "@lintel/motion";
import { applyAdjustments, adjustmentsOf, type SimpleAdjustments } from "../simple/adjustSpec.js";

/**
 * What the studio edits, and what undo steps through. The Simple panel's sliders are kept
 * as adjustments to `base` (the spec when a preset was picked) so they never drift; any
 * edit on the timeline becomes the new base.
 */
export interface StudioState {
  spec: MotionSpec;
  base: MotionSpec;
  adjustments: SimpleAdjustments;
  presetId: string | undefined;
}

export function stateFromSpec(spec: MotionSpec, presetId?: string): StudioState {
  return { spec, base: spec, adjustments: adjustmentsOf(spec), presetId };
}

export function withAdjustments(state: StudioState, adjustments: SimpleAdjustments): StudioState {
  return { ...state, adjustments, spec: applyAdjustments(state.base, adjustments) };
}

/** An edit made directly to the spec (on the timeline, or the trigger) becomes the new base. */
export function withEditedSpec(state: StudioState, spec: MotionSpec): StudioState {
  return { ...state, spec, base: spec, adjustments: adjustmentsOf(spec) };
}

/** A change that doesn't touch timing (the trigger, reduced motion) keeps the sliders where they are. */
export function withBaseChange(
  state: StudioState,
  change: (spec: MotionSpec) => MotionSpec,
): StudioState {
  const base = change(state.base);
  return { ...state, base, spec: applyAdjustments(base, state.adjustments) };
}
