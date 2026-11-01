import { createContext, useContext } from "react";
import type { AddressChange, TreeNode } from "./contentTree.types.js";
import type { TreeAction, TreeTarget } from "./treeActions.js";
import type { SelectGesture } from "./treeSelection.js";
import type { TreeNotice } from "./TreeToast.js";
import type { TreeKey } from "./treeState.js";

/** What every part of the tree shares: the site, open branches, dragging and actions. */
export interface ContentTreeState {
  /** The site the admin works on; undefined for the main site. */
  siteId: string | undefined;
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
  /** Says a sort was saved, offering redirects when it changed live pages' addresses. */
  announceSorted: (addressChanges: AddressChange[]) => void;
  canUpdate: boolean;
  /** Entries picked with Ctrl/⌘-click, Shift-click or Space, for the selection bar. */
  selection: ReadonlySet<string>;
  selectedNodes: readonly TreeNode[];
  selectNode: (node: TreeNode, gesture: SelectGesture) => void;
  /** Shift and an arrow key moved focus from one row to another. */
  extendSelection: (key: TreeKey, fromKey: TreeKey) => void;
  clearSelection: () => void;
  /** Rows tell the tree what they show, so a Shift-click run knows its entries. */
  rememberNode: (node: TreeNode) => void;
  /** A note at the bottom of the tree, such as "Moved 3 pages to the recycle bin. Undo". */
  notify: (notice: Omit<TreeNotice, "id">) => void;
}

export const ContentTreeContext = createContext<ContentTreeState | null>(null);

export function useContentTree(): ContentTreeState {
  const state = useContext(ContentTreeContext);
  if (!state) {
    throw new Error("useContentTree needs the Content section: render it inside ContentSection.");
  }
  return state;
}
