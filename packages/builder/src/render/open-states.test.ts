import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { describe, expect, it } from "vitest";
import { renderPage } from "./render-page.js";
import { standardRegistry } from "./stand-in-components.js";

function cardWithOpenState(): { document: PageDocument; cardId: string } {
  const card = createNode(
    { type: "box", name: "Card", children: [{ type: "text", name: "More" }] },
    standardCatalogue,
    createCountingNodeIds("c"),
  );
  card.children[0]!.styles.owners = { [`open@${card.id}`]: { opacity: "1" } };
  const page = createEmptyPage();
  return { document: { ...page, root: { ...page.root, children: [card] } }, cardId: card.id };
}

describe("open states on the website", () => {
  it("marks an element that opens, and asks for the elements script", () => {
    const { document } = cardWithOpenState();
    const site = renderPage(document, standardRegistry);
    expect(site.html).toContain("data-lintel-opens");
    expect(site.usesBehaviours).toBe(true);
  });

  it("leaves the canvas without the marker", () => {
    const { document } = cardWithOpenState();
    expect(renderPage(document, standardRegistry, { mode: "canvas" }).html).not.toContain(
      "data-lintel-opens",
    );
  });
});
