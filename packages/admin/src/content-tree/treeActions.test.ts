import { describe, expect, it } from "vitest";
import type { TreeNode, TreeRoot } from "./contentTree.types.js";
import { actionsFor, nodeState } from "./treeActions.js";

const everything = { create: true, update: true, publish: true, delete: true };

function node(overrides: Partial<TreeNode> = {}): TreeNode {
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

describe("the actions menu", () => {
  it("offers what makes sense for a draft with nothing under it", () => {
    expect(actionsFor({ kind: "entry", node: node() }, everything)).toEqual([
      "create",
      "duplicate",
      "move",
      "publish",
      "preview",
      "history",
      "info",
      "delete",
    ]);
  });

  it("offers sorting, unpublishing and View page for a live page with children", () => {
    const actions = actionsFor(
      { kind: "entry", node: node({ status: "published", childCount: 3 }) },
      everything,
    );
    expect(actions).toEqual(expect.arrayContaining(["sort", "unpublish", "viewPage", "publish"]));
  });

  it("leaves out what the person may not do", () => {
    const readOnly = { create: false, update: false, publish: false, delete: false };
    expect(actionsFor({ kind: "entry", node: node() }, readOnly)).toEqual([
      "preview",
      "history",
      "info",
    ]);
  });

  it("offers Create, Sort and the list for a section, but never sorts a dated one", () => {
    const pages: TreeRoot = {
      handle: "pages",
      name: "Pages",
      blueprintHandle: "page",
      structure: "tree",
      childCount: 4,
      childrenAsCollection: false,
    };
    expect(actionsFor({ kind: "root", root: pages }, everything)).toEqual([
      "create",
      "sort",
      "openList",
    ]);
    expect(
      actionsFor({ kind: "root", root: { ...pages, structure: "dated" } }, everything),
    ).toEqual(["create", "openList"]);
  });
});

describe("status dots", () => {
  it("tells a live page with newer changes apart from a live one", () => {
    expect(nodeState({ status: "published", hasUnpublishedChanges: false })).toBe("published");
    expect(nodeState({ status: "published", hasUnpublishedChanges: true })).toBe("changed");
    expect(nodeState({ status: "scheduled", hasUnpublishedChanges: false })).toBe("scheduled");
    expect(nodeState({ status: "draft", hasUnpublishedChanges: false })).toBe("draft");
  });
});
