import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type NodeBlueprint,
  type PageDocument,
  shapePresets,
  standardCatalogue,
} from "@lintel/builder-model";
import { describe, expect, it } from "vitest";
import { renderPage } from "./render-page.js";
import { standardRegistry } from "./stand-in-components.js";

function pageOf(...blueprints: NodeBlueprint[]): PageDocument {
  const page = createEmptyPage();
  const ids = createCountingNodeIds();
  return {
    ...page,
    root: {
      ...page.root,
      children: blueprints.map((blueprint) => createNode(blueprint, standardCatalogue, ids)),
    },
  };
}

/** The text of every element in document order: what a screen reader reads, in order. */
function readingOrder(html: string): string[] {
  const holder = document.createElement("div");
  holder.innerHTML = html;
  const texts: string[] = [];
  const walk = (node: Node) => {
    if (node instanceof Element && node.getAttribute("aria-hidden") === "true") return;
    if (node instanceof HTMLImageElement) texts.push(`[${node.alt}]`);
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      texts.push(node.textContent.trim());
    }
    node.childNodes.forEach(walk);
  };
  walk(holder);
  return texts;
}

describe("drawing advanced styles", () => {
  it("draws styled words as em and span with classes, and keeps line breaks", () => {
    const { html, css } = renderPage(
      pageOf({
        type: "heading",
        name: "Title",
        props: {
          text: "FREEDOM\nFOR",
          level: 1,
          marks: [
            { from: 2, to: 4, styles: { fontStyle: "italic" } },
            { from: 9, to: 11, styles: { fontStyle: "italic", fontWeight: "300" } },
          ],
        },
      }),
      standardRegistry,
    );
    expect(html).toContain(
      '<h1 class="title">FR<em>EE</em>DOM<br/>F<em class="title-mark-1">OR</em></h1>',
    );
    expect(css).toContain(".title-mark-1 {\n  font-weight: 300;\n}");
  });

  it("draws a background video that never autoplays, is hidden from screen readers and can be paused", () => {
    const { html, script } = renderPage(
      pageOf({
        type: "section",
        name: "Film",
        backgroundVideo: {
          src: "/media/sea.mp4",
          assetId: null,
          poster: "/media/sea.jpg",
          overlay: "",
        },
        children: [{ type: "heading", props: { text: "Sea", level: 2 } }],
      }),
      standardRegistry,
    );
    expect(html).toContain(
      '<div class="lintel-video-background"><video src="/media/sea.mp4" poster="/media/sea.jpg" muted="" loop="" playsInline="" preload="auto" aria-hidden="true" tabindex="-1" data-lintel-video=""></video><button type="button" class="lintel-video-toggle" hidden="">Pause background video</button></div><h2',
    );
    expect(script).toContain("prefers-reduced-motion: reduce");
    const canvas = renderPage(
      pageOf({
        type: "section",
        backgroundVideo: { src: "/v.mp4", assetId: null, poster: "", overlay: "" },
      }),
      standardRegistry,
      { mode: "canvas" },
    );
    expect(canvas.html).not.toContain("lintel-video-toggle");
    expect(canvas.script).toBe("");
  });

  it("marks free layouts on the canvas only, so they can be dragged in", () => {
    const blueprint: NodeBlueprint = { type: "section", freeLayout: { stackOnPhone: false } };
    expect(renderPage(pageOf(blueprint), standardRegistry, { mode: "canvas" }).html).toContain(
      'data-lintel-free="free"',
    );
    expect(renderPage(pageOf(blueprint), standardRegistry).html).not.toContain("data-lintel-free");
  });

  it("lists the page’s fonts to preload", () => {
    const page = pageOf({ type: "heading" });
    page.root.props = { fonts: [{ source: "catalogue", id: "yellowtail" }] };
    expect(renderPage(page, standardRegistry).fontPreloads).toEqual([
      "/_lintel/fonts/yellowtail-latin-400-normal.woff2",
    ]);
  });
});

describe("reading order with turned, cut and masked elements", () => {
  it("is the order in Layers, whatever is turned, cut, masked, stacked or placed freely", () => {
    const page = pageOf({
      type: "section",
      name: "Stage",
      freeLayout: { stackOnPhone: true },
      children: [
        {
          type: "heading",
          name: "Word",
          props: { text: "Freedom", level: 1 },
          styles: { base: { left: "0%", top: "40%", zIndex: "1" } },
        },
        {
          type: "image",
          name: "Sticker",
          props: { src: "/media/sticker.svg", alt: "Lookbook sticker" },
          styles: {
            base: {
              left: "30%",
              top: "10%",
              rotate: "-14deg",
              clipPath: shapePresets.slash,
              maskImage: "linear-gradient(black, transparent)",
              zIndex: "3",
            },
          },
        },
        {
          type: "text",
          name: "Line",
          props: {
            text: "Made for you",
            marks: [
              {
                from: 0,
                to: 4,
                styles: { textStroke: "1px currentColor", textFillColor: "transparent" },
              },
            ],
          },
          styles: { base: { left: "60%", top: "70%", writingMode: "vertical-rl", zIndex: "2" } },
        },
      ],
    });
    const { html } = renderPage(page, standardRegistry);
    expect(readingOrder(html)).toEqual(["Freedom", "[Lookbook sticker]", "Made", "for you"]);
    // Nothing visual hides content from assistive technology.
    expect(html).not.toContain("aria-hidden");
  });
});
