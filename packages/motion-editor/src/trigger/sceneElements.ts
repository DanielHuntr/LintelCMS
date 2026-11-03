import { createContext, useContext } from "react";

/**
 * The elements around the one being animated whose scroll scene it can be a step of (the
 * section held on screen, say), nearest first. The host (the page builder) knows the page, so
 * it provides them; without a host, a scroll animation only follows its own element.
 */
export interface SceneElement {
  id: string;
  name: string;
}

export const SceneElementsContext = createContext<readonly SceneElement[]>([]);

export function useSceneElements(): readonly SceneElement[] {
  return useContext(SceneElementsContext);
}
