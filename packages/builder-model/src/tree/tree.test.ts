import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import { createEmptyPage, type PageNode } from "../document/page-document.schema.js";
import { createNode } from "./create-node.js";
import { createCountingNodeIds } from "./node-ids.js";
import {
  duplicateNode,
  InvalidMoveError,
  insertNode,
  moveNode,
  removeNode,
  updateNode,
} from "./tree-changes.js";
import { countNodes, findPath, findPlace, listVisibleRows } from "./tree-queries.js";

function samplePage(): PageNode {
  const createId = createCountingNodeIds();
  const section = createNode(
    { type: "section", children: [{ type: "heading" }, { type: "text" }, { type: "button" }] },
    standardCatalogue,
    createId,
  );
  return { ...createEmptyPage().root, children: [section] };
}

const ids = (node: PageNode) => node.children.map((child) => child.id);

describe("changing a page tree", () => {
  it("makes nodes from blueprints with the component’s defaults", () => {
    const columns = createNode({ type: "columns" }, standardCatalogue, createCountingNodeIds("c"));
    expect(columns.children.map((child) => [child.id, child.type, child.name])).toEqual([
      ["c2", "box", "Column"],
      ["c3", "box", "Column"],
    ]);
    expect(columns.styles.phone).toEqual({ gridTemplateColumns: "minmax(0, 1fr)" });
  });

  it("moves a node forwards and backwards among its siblings", () => {
    const root = samplePage();
    expect(ids(moveNode(root, "n2", "n1", 3).children[0] as PageNode)).toEqual(["n3", "n4", "n2"]);
    expect(ids(moveNode(root, "n4", "n1", 0).children[0] as PageNode)).toEqual(["n4", "n2", "n3"]);
  });

  it("won’t move a node inside itself", () => {
    const root = samplePage();
    expect(() => moveNode(root, "n1", "n1", 0)).toThrow(InvalidMoveError);
  });

  it("shares untouched nodes with the old tree", () => {
    const root = samplePage();
    const renamed = updateNode(root, "n3", (node) => ({ ...node, name: "Intro" }));
    const [before, after] = [root.children[0] as PageNode, renamed.children[0] as PageNode];
    expect(after.children[0]).toBe(before.children[0]);
    expect(after.children[1]).not.toBe(before.children[1]);
    expect(root.children[0]?.children[1]?.name).toBe("");
  });

  it("duplicates a node straight after itself with new ids", () => {
    const { root, copyId } = duplicateNode(samplePage(), "n1", createCountingNodeIds("copy"));
    expect(copyId).toBe("copy1");
    expect(ids(root)).toEqual(["n1", "copy1"]);
    expect(ids(root.children[1] as PageNode)).toEqual(["copy2", "copy3", "copy4"]);
    expect(countNodes(root)).toBe(9);
  });

  it("inserts, removes and finds places", () => {
    const root = samplePage();
    const divider = createNode({ type: "divider" }, standardCatalogue, () => "d1");
    const withDivider = insertNode(root, "n1", 1, divider);
    expect(findPlace(withDivider, "d1")).toMatchObject({ index: 1, parent: { id: "n1" } });
    expect(findPath(withDivider, "d1").map((node) => node.id)).toEqual(["page", "n1", "d1"]);
    expect(ids(removeNode(withDivider, "d1").children[0] as PageNode)).toEqual(["n2", "n3", "n4"]);
  });

  it("lists layer rows, skipping collapsed ones", () => {
    const root = samplePage();
    expect(listVisibleRows(root, new Set()).map((row) => `${row.node.id}@${row.depth}`)).toEqual([
      "n1@0",
      "n2@1",
      "n3@1",
      "n4@1",
    ]);
    expect(listVisibleRows(root, new Set(["n1"])).length).toBe(1);
  });
});
