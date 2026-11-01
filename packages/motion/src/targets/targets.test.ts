// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { resolveTargets } from "./resolveTargets.js";
import { splitText } from "./splitText.js";
import { staggerDelays } from "./stagger.js";

const options = { nodeAttribute: "data-node-id" };

describe("staggering", () => {
  it("delays each target in the chosen order", () => {
    expect(staggerDelays(4, { each: 100, from: "first" })).toEqual([0, 100, 200, 300]);
    expect(staggerDelays(4, { each: 100, from: "last" })).toEqual([300, 200, 100, 0]);
    expect(staggerDelays(5, { each: 100, from: "center" })).toEqual([200, 100, 0, 100, 200]);
    expect(staggerDelays(5, { each: 100, from: "edges" })).toEqual([0, 100, 200, 100, 0]);
  });

  it("shuffles the same way every time", () => {
    const random = staggerDelays(6, { each: 10, from: "random" });
    expect(random).toEqual(staggerDelays(6, { each: 10, from: "random" }));
    expect([...random].sort((first, second) => first - second)).toEqual([0, 10, 20, 30, 40, 50]);
  });
});

describe("splitting text", () => {
  it("wraps each word, keeps inline markup and keeps one readable copy", () => {
    const heading = document.createElement("h2");
    heading.innerHTML = "Make <em>something</em> lovely";
    const split = splitText(heading, "words");
    expect(split.pieces.map((piece) => piece.textContent)).toEqual(["Make", "something", "lovely"]);
    expect(heading.querySelector("em .motion-word")?.textContent).toBe("something");
    const [spoken, visible] = Array.from(heading.children);
    expect(spoken?.textContent).toBe("Make something lovely");
    expect(visible?.getAttribute("aria-hidden")).toBe("true");
    split.restore();
    expect(heading.innerHTML).toBe("Make <em>something</em> lovely");
  });

  it("splits letters inside unbreakable words", () => {
    const heading = document.createElement("h2");
    heading.textContent = "Hi you";
    const split = splitText(heading, "letters");
    expect(split.pieces.map((piece) => piece.textContent)).toEqual(["H", "i", "y", "o", "u"]);
    expect(heading.querySelectorAll(".motion-word")).toHaveLength(2);
  });
});

describe("finding targets", () => {
  it("finds the element, its children, a selector or builder nodes", () => {
    document.body.innerHTML = `
      <section id="root"><p class="a">One</p><p>Two</p></section>
      <div data-node-id="hero">Hero</div>`;
    const root = document.getElementById("root") as HTMLElement;
    expect(resolveTargets(root, { type: "self" }, options).elements).toEqual([root]);
    expect(resolveTargets(root, { type: "children" }, options).elements).toHaveLength(2);
    expect(
      resolveTargets(root, { type: "selector", selector: ".a" }, options).elements,
    ).toHaveLength(1);
    const nodes = resolveTargets(root, { type: "nodes", nodeIds: ["hero", "missing"] }, options);
    expect(nodes.elements.map((element) => element.textContent)).toEqual(["Hero"]);
  });

  it("animates nothing for a selector that doesn't parse", () => {
    const root = document.createElement("div");
    expect(resolveTargets(root, { type: "selector", selector: "[[" }, options).elements).toEqual(
      [],
    );
  });
});
