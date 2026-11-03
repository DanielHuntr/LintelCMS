import { describe, expect, it } from "vitest";
import type { TreeNode, TreeRoot } from "./contentTree.types.js";
import { actionsFor, menuFor, nodeState, type MenuSection } from "./treeActions.js";

const everything = { create: true, update: true, publish: true, delete: true, settings: true };

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
    isSiteStart: false,
    ...overrides,
  };
}

const inSection = (
  target: Parameters<typeof menuFor>[0],
  section: MenuSection,
  can: Parameters<typeof menuFor>[1] = everything,
) =>
  menuFor(target, can)
    .filter((entry) => entry.section === section)
    .map((entry) => entry.action);

/** The rows someone sees before opening More: the actions in view, and More itself. */
function rowsInView(target: Parameters<typeof menuFor>[0]) {
  const entries = menuFor(target, everything);
  return entries.filter((entry) => entry.section !== "more").length + 1;
}

describe("the menu's groups", () => {
  it("keeps Create, Rename and Duplicate together at the top, then Delete at the end", () => {
    const entries = menuFor({ kind: "entry", node: node() }, everything);

    expect(entries.slice(0, 3).map((entry) => entry.action)).toEqual([
      "create",
      "rename",
      "duplicate",
    ]);
    expect(entries.at(-1)).toEqual({ action: "delete", section: "delete" });
  });

  it("offers a draft Publish and Preview, with no Unpublish in view", () => {
    expect(inSection({ kind: "entry", node: node() }, "publish")).toEqual(["publish", "preview"]);
  });

  it("offers a live page Unpublish and View page, with Preview under More", () => {
    const target = { kind: "entry", node: node({ status: "published" }) } as const;

    expect(inSection(target, "publish")).toEqual(["unpublish", "viewPage"]);
    expect(inSection(target, "more")).toContain("preview");
  });

  it("offers Publish first for a live page with changes, and Unpublish under More", () => {
    const target = {
      kind: "entry",
      node: node({ status: "published", hasUnpublishedChanges: true }),
    } as const;

    expect(inSection(target, "publish")).toEqual(["publish", "viewPage"]);
    expect(inSection(target, "more")).toContain("unpublish");
  });

  it("never shows Publish and Unpublish side by side, and loses neither for a branch", () => {
    for (const status of ["draft", "published", "scheduled"] as const) {
      for (const hasUnpublishedChanges of [false, true]) {
        const target = {
          kind: "entry",
          node: node({ status, hasUnpublishedChanges, childCount: 2 }),
        } as const;
        const inView = inSection(target, "publish");

        expect(inView.filter((action) => /publish/i.test(action))).toHaveLength(1);
        expect(menuFor(target, everything).map((entry) => entry.action)).toEqual(
          expect.arrayContaining(["publish", "unpublish"]),
        );
      }
    }
  });

  it("folds the rarely used actions under More", () => {
    const target = {
      kind: "entry",
      node: node({ status: "published", childCount: 3, isSiteStart: true }),
    } as const;

    expect(inSection(target, "more")).toEqual(
      expect.arrayContaining(["sort", "openList", "hostnames", "history", "info", "move"]),
    );
  });

  it("keeps the menu short: seven rows at most, whatever the page", () => {
    const busiest = node({
      status: "published",
      hasUnpublishedChanges: true,
      childCount: 3,
      isSiteStart: true,
    });

    expect(rowsInView({ kind: "entry", node: node() })).toBe(7);
    expect(rowsInView({ kind: "entry", node: busiest })).toBe(7);
  });

  it("offers everything actionsFor does, and nothing it doesn't", () => {
    const target = { kind: "entry", node: node({ childCount: 2 }) } as const;
    const actions = menuFor(target, everything).map((entry) => entry.action);

    expect([...actions].sort()).toEqual([...actionsFor(target, everything)].sort());
  });

  it("respects what the person may do", () => {
    const contentOnly = { ...everything, create: false, publish: false, delete: false };
    const target = { kind: "entry", node: node({ status: "published" }) } as const;

    expect(inSection(target, "publish", contentOnly)).toEqual(["viewPage"]);
    expect(inSection(target, "delete", contentOnly)).toEqual([]);
    expect(inSection(target, "make", contentOnly)).toEqual(["rename"]);
  });

  it("doesn't fold anything for a section, whose menu is short already", () => {
    const root: TreeRoot = {
      handle: "pages",
      name: "Pages",
      blueprintHandle: "page",
      structure: "tree",
      childCount: 3,
      childrenAsCollection: false,
    };

    expect(inSection({ kind: "root", root }, "more")).toEqual([]);
  });
});

describe("the actions menu", () => {
  it("offers what makes sense for a draft with nothing under it", () => {
    expect(actionsFor({ kind: "entry", node: node() }, everything)).toEqual([
      "create",
      "duplicate",
      "rename",
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
    const readOnly = {
      create: false,
      update: false,
      publish: false,
      delete: false,
      settings: false,
    };
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

describe("creating at the top of the tree", () => {
  it("offers Create on empty space and the + beside Content, to people who may create", () => {
    expect(actionsFor({ kind: "top" }, everything)).toEqual(["create"]);
    expect(actionsFor({ kind: "top" }, { ...everything, create: false })).toEqual([]);
  });

  it("offers Hostnames only for a page at the top, to people who may change settings", () => {
    const start = node({ isSiteStart: true });
    expect(actionsFor({ kind: "entry", node: start }, everything)).toContain("hostnames");
    expect(
      actionsFor({ kind: "entry", node: start }, { ...everything, settings: false }),
    ).not.toContain("hostnames");
    expect(actionsFor({ kind: "entry", node: node() }, everything)).not.toContain("hostnames");
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
