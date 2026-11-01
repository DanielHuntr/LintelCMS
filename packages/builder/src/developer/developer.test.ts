import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  findNode,
  findSectionTemplate,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { describe, expect, it } from "vitest";
import { englishText } from "../i18n/builder-text.js";
import { renderPage } from "../render/render-page.js";
import { standardRegistry } from "../render/stand-in-components.js";
import { convertToCode } from "./convert-to-code.js";
import { replaceWithHtml } from "./html-editing.js";
import { simpleHero } from "../testing/simple-hero.js";

function heroPage(): PageDocument {
  const page = createEmptyPage();
  const hero = createNode(simpleHero, standardCatalogue, createCountingNodeIds());
  return { ...page, root: { ...page.root, children: [hero] } };
}

const context = (document: PageDocument) => ({
  document,
  selectedId: null,
  catalogue: standardCatalogue,
  createId: createCountingNodeIds("new"),
  text: englishText,
});

describe("editing an element as HTML", () => {
  it("reads known tags back into elements, keeping styles by class", () => {
    const page = heroPage();
    const { html } = renderPage(page, standardRegistry, { nodeId: "n2" });
    const edited = html
      .replace("Good things, made well", "Better things")
      .replace("</div>", "<h3>New subtitle</h3></div>");
    const { result, codeBlocks } = replaceWithHtml(context(page), "n2", edited, false);
    if ("refused" in result) throw new Error(result.refused);
    const next = result.change.update(page);
    const container = next.root.children[0]?.children[0];
    expect(codeBlocks).toBe(0);
    expect(
      container?.children.map((node) => [
        node.type,
        node.name,
        node.props.text ?? node.props.label,
      ]),
    ).toEqual([
      ["heading", "Hero title", "Better things"],
      ["text", "", "Say in a sentence or two what you do and who it’s for."],
      ["button", "", "Get in touch"],
      ["heading", "", "New subtitle"],
    ]);
    expect(container?.styles).toEqual(findNode(page.root, "n2")?.styles);
    expect(container?.children[2]?.styles).toEqual(findNode(page.root, "n5")?.styles);
  });

  it("turns what doesn’t map into code blocks for developers", () => {
    const page = heroPage();
    const { result, codeBlocks } = replaceWithHtml(
      context(page),
      "n3",
      "<table><tr><td>1</td></tr></table>",
      true,
    );
    expect(codeBlocks).toBe(1);
    if ("refused" in result) throw new Error(result.refused);
    expect(findNode(result.change.update(page).root, result.change.select ?? "")?.type).toBe(
      "codeBlock",
    );
  });
});

describe("converting to code", () => {
  it("keeps the HTML and CSS, renames classes and marks texts and pictures editable", () => {
    const page = heroPage();
    const block = convertToCode(page, "n2", standardRegistry, createCountingNodeIds("code"));
    expect(block?.type).toBe("codeBlock");
    expect(block?.props.html).toBe(
      '<div class="container-code"><h1 class="hero-title-code" data-lintel-field="text-1">Good things, made well</h1><p class="paragraph-code" data-lintel-field="text-2">Say in a sentence or two what you do and who it’s for.</p><a class="button-code" href="/contact" data-lintel-field="text-3">Get in touch</a></div>',
    );
    expect(block?.props.css).toContain(".container-code {");
    expect(block?.props.css).toContain(".button-code:hover {");
    expect(block?.props.css).not.toMatch(/\.container \{/);
  });
});

describe("a large page", () => {
  it("renders 300 elements quickly", () => {
    const createId = createCountingNodeIds();
    const sections = Array.from({ length: 34 }, (_, index) =>
      createNode(
        index % 2 ? findSectionTemplate("features")!.blueprint : simpleHero,
        standardCatalogue,
        createId,
      ),
    );
    const page = { ...createEmptyPage(), root: { ...createEmptyPage().root, children: sections } };
    const { html } = renderPage(page, standardRegistry, { mode: "canvas" });
    expect(html.match(/data-lintel-node=/g)?.length).toBeGreaterThan(300);
    // A change to one element redraws the page; it takes a few milliseconds on a quiet machine; the limit leaves room for a busy test runner.
    const changed = {
      ...page,
      root: {
        ...page.root,
        children: [{ ...sections[0]!, name: "Changed" }, ...sections.slice(1)],
      },
    };
    const started = performance.now();
    renderPage(changed, standardRegistry, { mode: "canvas" });
    expect(performance.now() - started).toBeLessThan(400);
  });
});
