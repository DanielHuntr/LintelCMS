import { describe, expect, it } from "vitest";
import type { NodeBlueprint } from "../components/component-definition.js";
import { findSectionTemplate } from "./section-templates.js";

function everyNode(blueprint: NodeBlueprint): NodeBlueprint[] {
  return [blueprint, ...(blueprint.children ?? []).flatMap(everyNode)];
}

/*
 * "Footer with columns" used to bring sample words and links to pages the site may not have
 * ("About", "Contact", "Newsletter"). Its links now follow the site's main menu, and its one
 * line of words is plainly a placeholder (LINTEL-LEFT-006).
 */
describe("the Footer with columns section", () => {
  const nodes = everyNode(findSectionTemplate("footer-columns")!.blueprint);

  it("takes its links from the site's main menu", () => {
    expect(nodes.filter((node) => node.type === "link")).toEqual([]);
    expect(nodes.find((node) => node.type === "navigation")?.props).toMatchObject({
      menuSource: "site",
      menuHandle: "main",
    });
  });

  it("has no sample copy, only a line that asks to be replaced", () => {
    const words = nodes
      .filter((node) => node.type === "text" && node.name !== "Column title")
      .map((node) => (node.props as { text: string }).text);
    expect(words).toEqual([expect.stringMatching(/^Replace this with /)]);
  });
});
