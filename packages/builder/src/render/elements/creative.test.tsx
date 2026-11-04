import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type NodeBlueprint,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { describe, expect, it } from "vitest";
import { renderPage } from "../render-page.js";
import { standardRegistry } from "../stand-in-components.js";
import { circleWords } from "./creative.js";
import { elementStylesheet } from "./element-stylesheet.js";

/** The creative pack's elements as the published page draws them. */

function page(...blueprints: NodeBlueprint[]): PageDocument {
  const createId = createCountingNodeIds("e");
  const empty = createEmptyPage();
  return {
    ...empty,
    root: {
      ...empty.root,
      children: blueprints.map((blueprint) => createNode(blueprint, standardCatalogue, createId)),
    },
  };
}

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("text on a path", () => {
  it("draws the words around a circle once, for eyes, and once as text for screen readers", () => {
    const rendered = renderPage(
      page({ type: "pathText", props: { text: "Trust your gut · " } }),
      standardRegistry,
    );
    const html = parse(rendered.html);
    const element = html.querySelector(".lintel-path-text")!;
    expect(element.classList).toContain("lintel-path-text--circle");
    expect(element.classList).toContain("lintel-path-text--turn-slowly");
    expect(element.querySelector(".lintel-visually-hidden")?.textContent).toBe("Trust your gut · ");
    const drawing = element.querySelector("svg")!;
    expect(drawing.getAttribute("aria-hidden")).toBe("true");
    const textPath = drawing.querySelector("textPath")!;
    expect(textPath.getAttribute("href")).toBe(`#${drawing.querySelector("path")!.id}`);
    expect(textPath.getAttribute("textLength")).toBe("23.56");
    // No script: text on a path is SVG and CSS only.
    expect(rendered.effects).toEqual([]);
    expect(rendered.usesBehaviours).toBe(false);
  });

  it("centres the words along an arc or a wave, and never turns them", () => {
    for (const shape of ["arc", "wave"]) {
      const html = parse(
        renderPage(page({ type: "pathText", props: { shape, turn: "slowly" } }), standardRegistry)
          .html,
      );
      const textPath = html.querySelector("textPath")!;
      expect(textPath.getAttribute("startOffset")).toBe("50%");
      expect(textPath.getAttribute("text-anchor")).toBe("middle");
      expect(html.querySelector(".lintel-path-text")?.className).not.toContain("turn");
    }
  });

  it("keeps a gap where a circle's words meet themselves", () => {
    expect(circleWords("Trust your gut")).toBe("Trust your gut\u00a0·\u00a0");
    expect(circleWords(" Fresh · Local · ")).toBe("Fresh · Local ·\u00a0");
  });

  it("only turns for people who haven't asked for less motion", () => {
    const reduced = elementStylesheet.indexOf("@media (prefers-reduced-motion: no-preference)");
    expect(reduced).toBeGreaterThan(-1);
    expect(elementStylesheet.indexOf("lintel-path-turn 24s", reduced)).toBeGreaterThan(reduced);
  });
});

describe("a Rive element that responds to a click, undescribed", () => {
  it("is hidden from screen readers until its player makes it a named button", () => {
    const rendered = renderPage(
      page({ type: "riveAnimation", props: { respondTo: "click" } }),
      standardRegistry,
    );
    const rive = parse(rendered.html).querySelector(".lintel-animation");
    expect(rive?.getAttribute("aria-hidden")).toBe("true");
    expect(rive?.hasAttribute("role")).toBe(false);
    expect(rive?.hasAttribute("tabindex")).toBe(false);
  });
});

describe("the Lottie and Rive elements", () => {
  it("draw their poster and hand their settings to their players as effects", () => {
    const rendered = renderPage(
      page(
        {
          type: "lottieAnimation",
          props: {
            src: "/media/hop.lottie",
            play: "hover",
            label: "Dots hopping",
            poster: "/media/still.png",
          },
        },
        { type: "riveAnimation", props: { respondTo: "click", label: "Press me" } },
      ),
      standardRegistry,
    );
    const html = parse(rendered.html);
    const [lottie, rive] = [...html.querySelectorAll(".lintel-animation")];
    expect(lottie?.getAttribute("role")).toBe("img");
    expect(lottie?.getAttribute("aria-label")).toBe("Dots hopping");
    expect(lottie?.querySelector("img.lintel-animation__poster")?.getAttribute("src")).toBe(
      "/media/still.png",
    );
    // Its player makes it a button once the animation can answer a press.
    expect(rive?.getAttribute("role")).toBe("img");
    expect(rive?.hasAttribute("tabindex")).toBe(false);
    expect(
      rendered.effects.map(({ module, behaviour, params }) => ({ module, behaviour, params })),
    ).toEqual([
      {
        module: "lottie",
        behaviour: "lottiePlayer",
        params: { src: "/media/hop.lottie", play: "hover", loop: true },
      },
      {
        module: "rive",
        behaviour: "rivePlayer",
        params: { src: "", play: "view", respondTo: "click", input: "", stateMachine: "" },
      },
    ]);
  });

  it("are left to screen readers' silence when nobody described them", () => {
    const html = parse(renderPage(page({ type: "lottieAnimation" }), standardRegistry).html);
    expect(html.querySelector(".lintel-animation")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("the sticker playground", () => {
  it("is a named group of stickers that visitors can drag and throw", () => {
    const rendered = renderPage(page({ type: "stickerPlayground" }), standardRegistry);
    const html = parse(rendered.html);
    const group = html.querySelector(".lintel-sticker-playground")!;
    expect(group.getAttribute("role")).toBe("group");
    expect(group.getAttribute("aria-label")).toBe("Stickers to play with");
    expect(group.children.length).toBeGreaterThanOrEqual(4);
    expect(rendered.effects).toEqual([
      expect.objectContaining({ module: "playground", behaviour: "dragPlayground" }),
    ]);
  });
});
