import type { MotionSpec } from "@lintel/motion";
import type { PageNode } from "@lintel/builder-model";

/** One animation to play on the published page: the element's id and its spec. */
export interface PageAnimation {
  nodeId: string;
  spec: MotionSpec;
}

/**
 * Every animation on the visible part of a page, in page order. Hidden elements, and
 * everything inside them, aren't on the page, so their animations are left out too.
 */
export function collectAnimations(node: PageNode): PageAnimation[] {
  if (node.hidden) return [];
  const own = (node.animations ?? []).map((animation) => ({
    nodeId: node.id,
    spec: animation.spec,
  }));
  return [...own, ...node.children.flatMap(collectAnimations)];
}
