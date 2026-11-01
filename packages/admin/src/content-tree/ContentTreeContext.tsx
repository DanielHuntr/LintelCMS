import { createContext, useContext } from "react";
import type { TreeNode } from "./contentTree.types.js";
import type { TreeAction, TreeTarget } from "./treeActions.js";
import type { TreeKey } from "./treeState.js";

/** What every part of the tree shares: the site, open branches, dragging and actions. */
export interface ContentTreeState {
  siteId: string | undefined;
  setSiteId: (siteId: string | undefined) => void;
  expanded: ReadonlySet<TreeKey>;
  toggle: (key: TreeKey) => void;
  open: (keys: readonly TreeKey[]) => void;
  /** The entry or section the workspace shows, so its row looks selected. */
  selectedKey: TreeKey | undefined;
  /** Starts an action from a menu: opens its dialog, or goes straight to a screen. */
  runAction: (action: TreeAction, target: TreeTarget) => void;
  /** The entry being dragged, while a drag is on. */
  dragged: TreeNode | undefined;
  setDragged: (node: TreeNode | undefined) => void;
  /** Moves an entry, offering to undo it afterwards. */
  moveWithUndo: (node: TreeNode, parentId: string | null, index: number) => Promise<void>;
  canUpdate: boolean;
}

export const ContentTreeContext = createContext<ContentTreeState | null>(null);

export function useContentTree(): ContentTreeState {
  const state = useContext(ContentTreeContext);
  if (!state) {
    throw new Error("useContentTree needs the Content section: render it inside ContentSection.");
  }
  return state;
}
