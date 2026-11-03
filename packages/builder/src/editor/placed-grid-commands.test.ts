import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { describe, expect, it } from "vitest";
import { englishText } from "../i18n/builder-text.js";
import type { CommandContext, CommandResult } from "./commands.js";
import { placeOnGrid, setFreeLayout, setPlacedGrid } from "./design-commands.js";

function contextFor(document: PageDocument): CommandContext {
  return {
    document,
    selectedId: null,
    catalogue: standardCatalogue,
    createId: createCountingNodeIds("new"),
    text: englishText,
  };
}

function page(): PageDocument {
  const empty = createEmptyPage();
  const box = createNode(
    {
      type: "box",
      name: "Story",
      children: [
        { type: "image", name: "Photo" },
        { type: "heading", name: "Title", props: { text: "Harbour", level: 2 } },
      ],
    },
    standardCatalogue,
    createCountingNodeIds(),
  );
  return { ...empty, root: { ...empty.root, children: [box] } };
}

function apply(document: PageDocument, result: CommandResult): PageDocument {
  if ("refused" in result) throw new Error(result.refused);
  return result.change.update(document);
}

const story = (document: PageDocument) => document.root.children[0]!;

describe("placed grid commands", () => {
  it("puts a box on a grid, taking away its stack, and back again", () => {
    const start = page();
    expect(story(start).styles.base).toMatchObject({ display: "flex", flexDirection: "column" });
    const id = story(start).id;
    const onGrid = apply(
      start,
      setPlacedGrid(contextFor(start), id, { columns: 12, stackOnPhone: true }),
    );
    expect(story(onGrid).placedGrid).toEqual({ columns: 12, stackOnPhone: true });
    expect(story(onGrid).styles.base.display).toBeUndefined();
    expect(story(onGrid).styles.base.flexDirection).toBeUndefined();
    // The gap is kept: it's the space between columns now.
    expect(story(onGrid).styles.base.gap).toBe("var(--lintel-space-4)");

    const photoId = story(onGrid).children[0]!.id;
    const placed = apply(
      onGrid,
      placeOnGrid(
        contextFor(onGrid),
        photoId,
        "base",
        { column: 2, columnSpan: 5, row: 1, rowSpan: 3 },
        "Moved Photo",
      ),
    );
    expect(story(placed).children[0]!.styles.base).toMatchObject({
      gridColumn: "2 / span 5",
      gridRow: "1 / span 3",
    });

    const back = apply(placed, setPlacedGrid(contextFor(placed), id, null));
    expect(story(back).placedGrid).toBeUndefined();
    expect(story(back).styles.base).toMatchObject({ display: "flex", flexDirection: "column" });
    expect(story(back).children[0]!.styles.base.gridColumn).toBeUndefined();
  });

  it("keeps places on the grid when it gets fewer columns, at every screen size", () => {
    const start = page();
    const id = story(start).id;
    let document = apply(
      start,
      setPlacedGrid(contextFor(start), id, { columns: 12, stackOnPhone: false }),
    );
    const photoId = story(document).children[0]!.id;
    document = apply(
      document,
      placeOnGrid(
        contextFor(document),
        photoId,
        "tablet",
        { column: 8, columnSpan: 5, row: 2, rowSpan: 1 },
        "Moved",
      ),
    );
    document = apply(
      document,
      setPlacedGrid(contextFor(document), id, { columns: 6, stackOnPhone: false }),
    );
    expect(story(document).children[0]!.styles.tablet?.gridColumn).toBe("2 / span 5");
  });

  it("clamps places from the canvas, and refuses elements that aren't on a grid", () => {
    const start = page();
    const id = story(start).id;
    const onGrid = apply(
      start,
      setPlacedGrid(contextFor(start), id, { columns: 8, stackOnPhone: true }),
    );
    const titleId = story(onGrid).children[1]!.id;
    const placed = apply(
      onGrid,
      placeOnGrid(
        contextFor(onGrid),
        titleId,
        "phone",
        { column: 7, columnSpan: 4, row: 1, rowSpan: 1 },
        "Moved",
      ),
    );
    expect(story(placed).children[1]!.styles.phone).toEqual({
      gridColumn: "5 / span 4",
      gridRow: "1",
    });
    expect(
      placeOnGrid(
        contextFor(start),
        titleId,
        "base",
        { column: 1, columnSpan: 1, row: 1, rowSpan: 1 },
        "Moved",
      ),
    ).toEqual({ refused: "This element isn’t on a grid" });
  });

  it("has a free layout or a placed grid, never both", () => {
    const start = page();
    const id = story(start).id;
    const free = apply(start, setFreeLayout(contextFor(start), id, { stackOnPhone: true }));
    const onGrid = apply(
      free,
      setPlacedGrid(contextFor(free), id, { columns: 12, stackOnPhone: true }),
    );
    expect(story(onGrid).freeLayout).toBeUndefined();
    expect(story(onGrid).children[0]!.styles.base.left).toBeUndefined();
    const freeAgain = apply(onGrid, setFreeLayout(contextFor(onGrid), id, { stackOnPhone: true }));
    expect(story(freeAgain).placedGrid).toBeUndefined();
    expect(story(freeAgain).freeLayout).toEqual({ stackOnPhone: true });
  });
});
