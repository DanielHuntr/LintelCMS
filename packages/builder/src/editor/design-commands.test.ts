import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { describe, expect, it } from "vitest";
import { englishText } from "../i18n/builder-text.js";
import { changeProps, type CommandContext, type CommandResult } from "./commands.js";
import { markText, placeFreely, restackNode, setFreeLayout } from "./design-commands.js";

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
  const section = createNode(
    {
      type: "section",
      name: "Stage",
      children: [
        { type: "heading", name: "Word", props: { text: "Bold moves", level: 1 } },
        { type: "image", name: "Photo", styles: { base: { left: "40%", top: "10%" } } },
      ],
    },
    standardCatalogue,
    createCountingNodeIds(),
  );
  return { ...empty, root: { ...empty.root, children: [section] } };
}

function apply(document: PageDocument, result: CommandResult): PageDocument {
  if ("refused" in result) throw new Error(result.refused);
  return result.change.update(document);
}

describe("design commands", () => {
  it("switches free layout on and off, placing only children without a place", () => {
    const start = page();
    const sectionId = start.root.children[0]?.id ?? "";
    const free = apply(start, setFreeLayout(contextFor(start), sectionId, { stackOnPhone: true }));
    const [word, photo] = free.root.children[0]?.children ?? [];
    expect(word?.styles.base).toMatchObject({ left: "6%", top: "8%" });
    expect(photo?.styles.base).toMatchObject({ left: "40%", top: "10%" });

    const flowing = apply(free, setFreeLayout(contextFor(free), sectionId, null));
    expect(flowing.root.children[0]?.freeLayout).toBeUndefined();
    expect(flowing.root.children[0]?.children[1]?.styles.base.left).toBeUndefined();
  });

  it("places an element at one screen size and refuses locked ones", () => {
    const start = page();
    const photo = start.root.children[0]?.children[1];
    const placed = apply(
      start,
      placeFreely(contextFor(start), photo?.id ?? "", "tablet", { left: 12.345, top: 50 }, "Moved"),
    );
    expect(placed.root.children[0]?.children[1]?.styles.tablet).toEqual({
      left: "12.3%",
      top: "50%",
    });

    const locked = {
      ...start,
      root: { ...start.root, children: [{ ...start.root.children[0]!, locked: true }] },
    };
    const refused = placeFreely(
      contextFor(locked),
      photo?.id ?? "",
      "base",
      { left: 1, top: 1 },
      "Moved",
    );
    expect(refused).toEqual({ refused: expect.stringMatching(/locked/) });
  });

  it("brings forward and says when it can’t", () => {
    const start = page();
    const [word, photo] = start.root.children[0]?.children ?? [];
    const forward = apply(start, restackNode(contextFor(start), word?.id ?? "", "forward"));
    expect(forward.root.children[0]?.children.map((child) => child.styles.base.zIndex)).toEqual([
      "2",
      "1",
    ]);
    expect(restackNode(contextFor(start), photo?.id ?? "", "front")).toEqual({
      refused: "Photo is already in front",
    });
  });

  it("styles part of a text, and moves the styles when the text is edited", () => {
    const start = page();
    const word = start.root.children[0]?.children[0];
    const marked = apply(
      start,
      markText(
        contextFor(start),
        word?.id ?? "",
        { from: 5, to: 10 },
        { fontStyle: "italic" },
        "Italic",
      ),
    );
    expect(marked.root.children[0]?.children[0]?.props.marks).toEqual([
      { from: 5, to: 10, styles: { fontStyle: "italic" } },
    ]);
    const edited = apply(
      marked,
      changeProps(contextFor(marked), word?.id ?? "", { text: "Big bold moves" }, "Text"),
    );
    expect(edited.root.children[0]?.children[0]?.props.marks).toEqual([
      { from: 9, to: 14, styles: { fontStyle: "italic" } },
    ]);
    const cleared = apply(
      edited,
      markText(contextFor(edited), word?.id ?? "", { from: 0, to: 14 }, null, "Clear"),
    );
    expect(cleared.root.children[0]?.children[0]?.props).not.toHaveProperty("marks");
  });
});
