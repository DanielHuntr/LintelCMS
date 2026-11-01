import type { ReactNode } from "react";
import { ContentTreeContext, type ContentTreeState } from "./ContentTreeContext.js";
import type { TreeNode } from "./contentTree.types.js";

/** A tree node for tests, with sensible values for anything not given. */
export function testNode(overrides: Partial<TreeNode> = {}): TreeNode {
  return {
    id: "e1",
    title: "About",
    slug: "about",
    status: "draft",
    hasUnpublishedChanges: false,
    scheduledFor: null,
    updatedAt: "2026-11-01T09:00:00.000Z",
    parentId: null,
    locale: "en-GB",
    collection: { handle: "pages", name: "Pages" },
    childCount: 0,
    childrenAsCollection: false,
    ...overrides,
  };
}

/**
 * Renders workspace pieces that expect the Content section around them, without the tree.
 * Actions started from them are recorded in `actions`.
 */
export function WithTestTree({
  children,
  actions = [],
}: {
  children: ReactNode;
  actions?: unknown[];
}) {
  const state: ContentTreeState = {
    siteId: undefined,
    setSiteId: () => undefined,
    expanded: new Set(),
    toggle: () => undefined,
    open: () => undefined,
    selectedKey: undefined,
    runAction: (action, target) => actions.push({ action, target }),
    dragged: undefined,
    setDragged: () => undefined,
    moveWithUndo: async () => undefined,
    canUpdate: true,
  };
  return <ContentTreeContext value={state}>{children}</ContentTreeContext>;
}
