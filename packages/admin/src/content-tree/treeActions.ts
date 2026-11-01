import type { TreeNode, TreeRoot } from "./contentTree.types.js";

/** What an action in the tree is about: one entry, or a collection's whole section. */
export type TreeTarget = { kind: "entry"; node: TreeNode } | { kind: "root"; root: TreeRoot };

export type TreeAction =
  | "create"
  | "duplicate"
  | "move"
  | "sort"
  | "publish"
  | "unpublish"
  | "preview"
  | "viewPage"
  | "history"
  | "info"
  | "delete"
  | "openList";

/** The parts of the signed-in person's permissions the menu cares about. */
export interface ActionPermissions {
  create: boolean;
  update: boolean;
  publish: boolean;
  delete: boolean;
}

/**
 * The actions offered for a target, in menu order, leaving out what the person may not do
 * and what makes no sense here (sorting an empty folder, viewing a page that isn't live).
 */
export function actionsFor(target: TreeTarget, can: ActionPermissions): TreeAction[] {
  if (target.kind === "root") {
    const { root } = target;
    return [
      ...(can.create ? (["create"] as const) : []),
      ...(can.update && root.structure !== "dated" && root.childCount > 1
        ? (["sort"] as const)
        : []),
      "openList",
    ];
  }
  const { node } = target;
  const isLive = node.status === "published";
  const actions: TreeAction[] = [];
  if (can.create) actions.push("create", "duplicate");
  if (can.update) actions.push("move");
  if (can.update && node.childCount > 1) actions.push("sort");
  if (can.publish) {
    if (!isLive || node.hasUnpublishedChanges || node.childCount > 0) actions.push("publish");
    if (node.status !== "draft" || node.childCount > 0) actions.push("unpublish");
  }
  actions.push("preview");
  if (isLive) actions.push("viewPage");
  actions.push("history", "info");
  if (node.childrenAsCollection && node.childCount > 0) actions.push("openList");
  if (can.delete) actions.push("delete");
  return actions;
}

/** The tree's own words for an entry's state, which its status dot shows. */
export type NodeState = "published" | "changed" | "draft" | "scheduled";

export function nodeState(node: Pick<TreeNode, "status" | "hasUnpublishedChanges">): NodeState {
  if (node.status === "published") return node.hasUnpublishedChanges ? "changed" : "published";
  return node.status;
}
