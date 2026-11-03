import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import {
  createEmptyPage,
  pageDocumentSchema,
  type PageNode,
} from "../document/page-document.schema.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { duplicateNode } from "../tree/tree-changes.js";
import { assignClassNames } from "./class-names.js";
import { compileStatePreview, compileStylesheet } from "./compile-stylesheet.js";
import { resolveStyle, setStyle } from "./style-cascade.js";

/** A card (box) holding a picture: the card owns the states, the picture follows them. */
function cardPage(): PageNode {
  const card = createNode(
    { type: "box", name: "Card", children: [{ type: "image", name: "Picture" }] },
    standardCatalogue,
    createCountingNodeIds("c"),
  );
  return { ...createEmptyPage().root, children: [card] };
}

describe("states", () => {
  it("stores and reads styles for an owner's state, falling back to the desktop value", () => {
    const picture = cardPage().children[0]!.children[0]!;
    const styles = setStyle(picture.styles, "hover@c1", "scale", "1.06");
    expect(styles.owners).toEqual({ "hover@c1": { scale: "1.06" } });
    expect(resolveStyle(styles, "hover@c1", "scale")).toEqual({ value: "1.06", setAt: "hover@c1" });
    expect(resolveStyle(styles, "hover@c1", "opacity").setAt).toBeUndefined();
    expect(setStyle(styles, "hover@c1", "scale", undefined).owners).toBeUndefined();
  });

  it("writes own and owner states, with transitions only for people who don't ask for less motion", () => {
    const root = cardPage();
    const card = root.children[0]!;
    const picture = card.children[0]!;
    card.styles = { ...card.styles, hover: { translate: "0 -4px" }, pressed: { scale: "0.98" } };
    card.stateTransition = { feel: "springy", speed: "quick" };
    picture.styles = { ...picture.styles, owners: { "hover@c1": { scale: "1.06" } } };

    const css = compileStylesheet(root, assignClassNames(root, standardCatalogue));

    expect(css).toContain(".card:hover {\n  translate: 0 -4px;\n}");
    expect(css).toContain(".card:active {\n  scale: 0.98;\n}");
    expect(css).toContain(".card:hover .picture {\n  scale: 1.06;\n}");
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: no-preference\) \{\n {2}\.card \{\n {4}transition: translate 180ms cubic-bezier\(0\.34, 1\.56, 0\.64, 1\), scale 180ms/,
    );
    expect(css).toContain("  .picture {\n    transition: scale 180ms");
    expect(css).not.toContain("data-lintel-state");
  });

  it("lets the canvas show an owner's state while it's designed", () => {
    const root = cardPage();
    const card = root.children[0]!;
    card.styles = { ...card.styles, hover: { translate: "0 -4px" } };
    card.children[0]!.styles.owners = { "hover@c1": { scale: "1.06" } };
    const classNames = assignClassNames(root, standardCatalogue);
    const expected = ".card {\n  translate: 0 -4px;\n}\n\n.card .picture {\n  scale: 1.06;\n}";
    // Editing the card's own hover, or the picture's "while the card is hovered", shows both.
    expect(compileStatePreview(root, classNames, "c1", "hover")).toBe(expected);
    expect(compileStatePreview(root, classNames, "c2", "hover@c1")).toBe(expected);
    expect(compileStatePreview(root, classNames, "c1", "base")).toBe("");
  });

  it("refuses an owner state that isn't one", () => {
    const root = cardPage();
    root.children[0]!.children[0]!.styles.owners = { "wobble@c1": { scale: "2" } } as never;
    expect(pageDocumentSchema.safeParse({ ...createEmptyPage(), root }).success).toBe(false);
  });

  it("points a copied card's picture at the copied card", () => {
    const root = cardPage();
    root.children[0]!.children[0]!.styles.owners = { "hover@c1": { scale: "1.06" } };
    const { root: copied } = duplicateNode(root, "c1", createCountingNodeIds("copy"));
    expect(copied.children[0]!.children[0]!.styles.owners).toEqual({
      "hover@c1": { scale: "1.06" },
    });
    expect(copied.children[1]!.children[0]!.styles.owners).toEqual({
      "hover@copy1": { scale: "1.06" },
    });
  });
});
