import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type PageNode,
  standardCatalogue,
} from "@lintel/builder-model";
import { describe, expect, it } from "vitest";
import { simpleHero } from "../testing/simple-hero.js";
import { canvasDropTarget } from "./canvas-drop.js";

// Dragging from Insert onto the canvas did nothing: only Layers took drops.
function heroPage(): { root: PageNode; hero: PageNode; container: PageNode } {
  const page = createEmptyPage();
  const hero = createNode(simpleHero, standardCatalogue, createCountingNodeIds());
  const root = { ...page.root, children: [hero] };
  const container = hero.children[0] as PageNode;
  return { root, hero, container };
}

describe("dropping something from Insert on the canvas", () => {
  it("puts an element inside the box the pointer is in the middle of", () => {
    const { root, container } = heroPage();

    const target = canvasDropTarget(root, standardCatalogue, "heading", [
      { nodeId: container.id, ratio: 0.5, across: false },
    ]);

    expect(target).toMatchObject({
      nodeId: container.id,
      position: "inside",
      place: { parentId: container.id, index: container.children.length },
    });
  });

  it("puts an element before or after the one the pointer is near the edge of", () => {
    const { root, container } = heroPage();
    const title = container.children[0] as PageNode;

    expect(
      canvasDropTarget(root, standardCatalogue, "text", [
        { nodeId: title.id, ratio: 0.9, across: false },
      ]),
    ).toMatchObject({
      nodeId: title.id,
      position: "after",
      place: { index: 1 },
    });
    expect(
      canvasDropTarget(root, standardCatalogue, "text", [
        { nodeId: title.id, ratio: 0.1, across: false },
      ]),
    ).toMatchObject({
      nodeId: title.id,
      position: "before",
      place: { index: 0 },
    });
  });

  it("puts a section dropped over a heading before or after that heading's section", () => {
    const { root, hero, container } = heroPage();
    const title = container.children[0] as PageNode;
    // The pointer is low in the title, but near the top of the hero.
    const chain = [
      { nodeId: title.id, ratio: 0.9, across: false },
      { nodeId: container.id, ratio: 0.3, across: false },
      { nodeId: hero.id, ratio: 0.2, across: false },
    ];

    expect(canvasDropTarget(root, standardCatalogue, "section", chain)).toMatchObject({
      nodeId: hero.id,
      position: "before",
      place: { parentId: root.id, index: 0 },
    });
  });

  it("hands an element the box around it when the one under the pointer can't take it", () => {
    const { root, container } = heroPage();
    const title = container.children[0] as PageNode;
    const chain = [
      { nodeId: title.id, ratio: 0.5, across: false },
      { nodeId: container.id, ratio: 0.5, across: false },
    ];

    // A heading can't hold a picture, so it goes before or after the heading instead.
    expect(canvasDropTarget(root, standardCatalogue, "image", chain)).toMatchObject({
      nodeId: title.id,
      place: { parentId: container.id },
    });
  });

  it("draws an upright line beside an element that sits in a row", () => {
    const { root, container } = heroPage();
    const button = container.children[2] as PageNode;

    expect(
      canvasDropTarget(root, standardCatalogue, "text", [
        { nodeId: button.id, ratio: 0.1, across: true },
      ]),
    ).toMatchObject({
      nodeId: button.id,
      position: "before",
      across: true,
    });
  });

  it("adds to the end of the page when let go below everything", () => {
    const { root, hero } = heroPage();

    const target = canvasDropTarget(root, standardCatalogue, "section", []);

    expect(target).toMatchObject({
      nodeId: hero.id,
      position: "after",
      place: { parentId: root.id, index: 1 },
    });
  });
});
