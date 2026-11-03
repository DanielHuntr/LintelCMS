import { impliedMenuLinkEffect, type PageNode } from "@lintel/builder-model";
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
  /** Each element with effects and the attributes they add, such as `data-lintel-carried`. */
  attributes: Map<string, Record<string, string>>;
}

export function collectNodeEffects(
  node: PageNode,
): Array<{ nodeId: string; effects: NodeEffect[] }> {
  if (node.hidden) return [];
  // A Menu link that scrambles on hover runs the scramble effect on every link.
  const implied = impliedMenuLinkEffect(node);
  const effects = implied ? [...(node.effects ?? []), implied] : (node.effects ?? []);
  const own = effects.length ? [{ nodeId: node.id, effects }] : [];
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
  const { bindings, css, attributes } = resolveNodeEffects(
    collectNodeEffects(node),
    registry,
    canvas ? canvasEffectSelector : undefined,
  );
  return { bindings, css, attributes };
}

/**
 * Whether a code block on the page uses the motion runtime (`window.lintelMotion`), so the
 * website loads it even when the page has no animations or effects of its own.
 */
export function usesMotionApi(node: PageNode): boolean {
  if (node.hidden) return false;
  const code = node.type === "codeBlock" ? node.props.js : undefined;
  return (
    (typeof code === "string" && code.includes("lintelMotion")) || node.children.some(usesMotionApi)
  );
}
