import type { TreeNode, TreeRoot } from "./contentTree.types.js";

/**
 * What an action in the tree is about: one entry, a collection's whole section, or the top
 * of the tree itself (the "+" beside Content, or a right-click on empty space).
 */
export type TreeTarget =
  | { kind: "entry"; node: TreeNode }
  | { kind: "root"; root: TreeRoot }
  | { kind: "top"; isHome?: boolean };

export type TreeAction =
  | "create"
  | "duplicate"
  | "rename"
  | "move"
  | "sort"
  | "publish"
  | "unpublish"
  | "preview"
  | "viewPage"
  | "history"
  | "info"
  | "delete"
  | "openList"
  | "hostnames";

/** The parts of the signed-in person's permissions the menu cares about. */
export interface ActionPermissions {
  create: boolean;
  update: boolean;
  publish: boolean;
  delete: boolean;
  /** Giving a page its own domain or path changes where the site answers: a settings change. */
  settings: boolean;
}

/**
 * The actions offered for a target, in menu order, leaving out what the person may not do
 * and what makes no sense here (sorting an empty folder, viewing a page that isn't live).
 */
export function actionsFor(target: TreeTarget, can: ActionPermissions): TreeAction[] {
  if (target.kind === "top") {
    return can.create ? ["create"] : [];
  }
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
  if (can.update) actions.push("rename", "move");
  if (can.update && node.childCount > 1) actions.push("sort");
  if (can.publish) {
    if (!isLive || node.hasUnpublishedChanges || node.childCount > 0) actions.push("publish");
    if (node.status !== "draft" || node.childCount > 0) actions.push("unpublish");
  }
  actions.push("preview");
  if (isLive) actions.push("viewPage");
  actions.push("history", "info");
  if (node.childCount > 0) actions.push("openList");
  if (can.settings && node.isSiteStart) actions.push("hostnames");
  if (can.delete) actions.push("delete");
  return actions;
}

/**
 * Where an action sits in the menu. "more" is folded away, so what most people want stays
 * short: Create, Rename, Duplicate; one publishing action and one way to see the page; Delete.
 */
export type MenuSection = "make" | "publish" | "more" | "delete";

export interface MenuEntry {
  action: TreeAction;
  section: MenuSection;
}

const makeActions: readonly TreeAction[] = ["create", "rename", "duplicate"];
const sectionOrder: readonly MenuSection[] = ["make", "publish", "more", "delete"];

/** Publish, or Unpublish for a live page with nothing waiting: the one that applies now. */
function mainPublishAction(node: TreeNode): TreeAction {
  return node.status === "published" && !node.hasUnpublishedChanges ? "unpublish" : "publish";
}

/**
 * `actionsFor`, arranged for the menu. Nothing is lost: the publishing action that doesn't
 * apply to this page itself may still apply to the pages under it, so it waits under More.
 */
export function menuFor(target: TreeTarget, can: ActionPermissions): MenuEntry[] {
  const actions = actionsFor(target, can);
  if (target.kind !== "entry") return actions.map((action) => ({ action, section: "make" }));
  const { node } = target;
  const seePage: TreeAction = node.status === "published" ? "viewPage" : "preview";
  const inPublish = [mainPublishAction(node), seePage];
  const sectionOf = (action: TreeAction): MenuSection => {
    if (action === "delete") return "delete";
    if (makeActions.includes(action)) return "make";
    return inPublish.includes(action) ? "publish" : "more";
  };
  const entries = actions.map((action) => ({ action, section: sectionOf(action) }));
  return sectionOrder.flatMap((section) => {
    const inSection = entries.filter((entry) => entry.section === section);
    return section === "make"
      ? inSection.sort((a, b) => makeActions.indexOf(a.action) - makeActions.indexOf(b.action))
      : inSection;
  });
}

/** The tree's own words for an entry's state, which its status mark shows. */
export type NodeState = "published" | "changed" | "draft" | "scheduled";

export function nodeState(node: Pick<TreeNode, "status" | "hasUnpublishedChanges">): NodeState {
  if (node.status === "published") return node.hasUnpublishedChanges ? "changed" : "published";
  return node.status;
}
