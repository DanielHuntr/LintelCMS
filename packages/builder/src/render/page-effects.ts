import type { PageNode } from "@lintel/builder-model";
import {
  effectRegistry,
  resolveNodeEffects,
  type EffectBinding,
  type EffectRegistry,
  type NodeEffect,
} from "@lintel/motion/effects";

/**
 * The effects on the visible part of a page, in page order, turned into what the website
 * runs: the bindings the effects runtime mounts and the static CSS written into the page.
 * Hidden elements, and everything inside them, are left out, as with animations.
 */

export interface PageEffects {
  bindings: EffectBinding[];
  css: string;
}

export function collectNodeEffects(
  node: PageNode,
): Array<{ nodeId: string; effects: NodeEffect[] }> {
  if (node.hidden) return [];
  const own = node.effects?.length ? [{ nodeId: node.id, effects: node.effects }] : [];
  return [...own, ...node.children.flatMap(collectNodeEffects)];
}

/** On the canvas, elements are found by the canvas's own attribute rather than the site's. */
export const canvasEffectSelector = (nodeId: string) =>
  `[data-lintel-node="${nodeId.replace(/["\\]/g, "\\$&")}"]`;

export function collectEffects(
  node: PageNode,
  {
    canvas = false,
    registry = effectRegistry,
  }: { canvas?: boolean; registry?: EffectRegistry } = {},
): PageEffects {
  const { bindings, css } = resolveNodeEffects(
    collectNodeEffects(node),
    registry,
    canvas ? canvasEffectSelector : undefined,
  );
  return { bindings, css };
}
