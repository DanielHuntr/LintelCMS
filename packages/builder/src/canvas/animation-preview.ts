import { impliedAnimationEffect, type PageNode } from "@lintel/builder-model";
import { cleanProps, effectRegistry } from "@lintel/motion/effects";
import { useEffect } from "react";
import type { EffectPreview } from "../animate-panel/AnimatePanel.js";

/**
 * The canvas doesn't run effects all the time, only previews. A Lottie or Rive element is
 * only its animation, though, so while one is selected the canvas plays it (with the file
 * chosen in its Content panel, or Lintel's sample), and stops when something else is.
 */

/** What the canvas previews for a node: its player with its settings, or nothing. */
export function animationPreviewFor(node: PageNode | undefined): EffectPreview | null {
  const implied = node && impliedAnimationEffect(node);
  const definition = implied && effectRegistry.find(implied.effect);
  if (!implied || definition?.kind !== "behaviour" || definition.module === "custom") return null;
  return {
    module: definition.module,
    behaviour: definition.behaviour,
    params: cleanProps(definition, implied.params),
  };
}

export function useAnimationElementPreview(
  node: PageNode | undefined,
  previewEffect: (nodeId: string, effect: EffectPreview | null) => void,
): void {
  const preview = animationPreviewFor(node);
  const key = preview ? `${node?.id}:${JSON.stringify(preview.params)}` : "";
  useEffect(() => {
    if (!node || !preview) return;
    previewEffect(node.id, preview);
    return () => previewEffect(node.id, null);
    // Played again only when the element or its settings change, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, previewEffect]);
}
