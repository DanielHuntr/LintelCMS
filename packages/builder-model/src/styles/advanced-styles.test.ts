import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import type { NodeBlueprint } from "../components/component-definition.js";
import { createEmptyPage, type PageDocument } from "../document/page-document.schema.js";
import { validatePageDocument } from "../document/validate-page.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import {
  backgroundLayerStyles,
  gradientValue,
  overlayLayer,
  parseGradient,
  pictureLayer,
  readBackgroundLayers,
} from "./background-layers.js";
import { assignClassNames } from "./class-names.js";
import {
  findShapePreset,
  insertPointAfter,
  movePoint,
  parsePolygon,
  polygonValue,
  removePoint,
  shapePresets,
} from "./clip-shapes.js";
import { compileStylesheet } from "./compile-stylesheet.js";
import {
  filterValue,
  fluidSize,
  parseFilters,
  parseSkew,
  readFluidSize,
  skewValue,
} from "./effect-values.js";
import { isSafeValueFor, splitTopLevel } from "./style-values.js";

function pageWith(
  children: NodeBlueprint[],
  pageProps: Record<string, unknown> = {},
): PageDocument {
  const ids = createCountingNodeIds();
  const page = createEmptyPage();
  return {
    ...page,
    root: {
      ...page.root,
      props: pageProps,
      children: children.map((child) => createNode(child, standardCatalogue, ids)),
    },
  };
}

function stylesheetOf(document: PageDocument): string {
  return compileStylesheet(document.root, assignClassNames(document.root, standardCatalogue));
}

describe("advanced style values", () => {
  it("accept pictures only from the site or the web, and gradients", () => {
    expect(isSafeValueFor("backgroundImage", 'url("/media/sea.jpg")')).toBe(true);
    expect(
      isSafeValueFor(
        "backgroundImage",
        'linear-gradient(180deg, rgb(0 0 0 / 0.4) 0%, transparent 100%), url("https://cdn.example.com/a.png")',
      ),
    ).toBe(true);
    expect(isSafeValueFor("maskImage", "radial-gradient(circle, black 60%, transparent 61%)")).toBe(
      true,
    );
    expect(isSafeValueFor("backgroundImage", 'url("javascript:alert(1)")')).toBe(false);
    expect(isSafeValueFor("backgroundImage", 'url("/a.png") ; color: red')).toBe(false);
    expect(isSafeValueFor("backgroundImage", 'url("/a b.png")')).toBe(false);
    expect(isSafeValueFor("backgroundImage", "url(//evil.example/x.png)")).toBe(false);
    expect(isSafeValueFor("backgroundImage", "image-set(a)")).toBe(false);
    // Elsewhere url() is still refused.
    expect(isSafeValueFor("backgroundColor", 'url("/a.png")')).toBe(false);
  });

  it("accept only shapes for clip-path, filters for filter and skews for transform", () => {
    for (const shape of Object.values(shapePresets))
      expect(isSafeValueFor("clipPath", shape)).toBe(true);
    expect(isSafeValueFor("clipPath", "polygon(0% 0%, 100% 0%) circle(5%)")).toBe(false);
    expect(isSafeValueFor("clipPath", "path('M0 0')")).toBe(false);
    expect(
      isSafeValueFor("filter", "blur(4px) grayscale(100%) drop-shadow(0 4px 8px rgb(0 0 0 / 0.3))"),
    ).toBe(true);
    expect(isSafeValueFor("filter", "url(#svg-filter)")).toBe(false);
    expect(isSafeValueFor("backdropFilter", "blur(12px) saturate(140%)")).toBe(true);
    expect(isSafeValueFor("transform", "skew(-8deg, 0deg)")).toBe(true);
    expect(isSafeValueFor("transform", "evil(1)")).toBe(false);
    expect(isSafeValueFor("rotate", "-12deg")).toBe(true);
  });

  it("split layers at their own commas only", () => {
    expect(splitTopLevel('url("/a,b.png"), linear-gradient(red, blue)')).toEqual([
      'url("/a,b.png")',
      "linear-gradient(red, blue)",
    ]);
  });

  it("are refused by page validation with the property named", () => {
    const document = pageWith([
      { type: "section", styles: { base: { backgroundImage: 'url("data:text/html,hi")' } } },
    ]);
    const checked = validatePageDocument(document, standardCatalogue);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.problems[0]?.message).toMatch(/backgroundImage/);
  });
});

describe("the advanced stylesheet", () => {
  it("prints transforms, shapes, masks, layered backgrounds, blends and filters per size and hover", () => {
    const document = pageWith([
      {
        type: "section",
        name: "Hero",
        props: { element: "section", anchor: "" },
        styles: {
          base: {
            backgroundImage:
              'linear-gradient(180deg, rgb(0 0 0 / 0.3) 0%, rgb(0 0 0 / 0.3) 100%), url("/media/field.jpg")',
            backgroundSize: "auto, cover",
            backgroundPosition: "0% 0%, 30% 60%",
            backgroundRepeat: "repeat, no-repeat",
            backgroundBlendMode: "multiply",
          },
        },
        children: [
          {
            type: "heading",
            name: "Title",
            props: { text: "BOLD", level: 1 },
            styles: {
              base: {
                fontSize: fluidSize(3, 9),
                textStroke: "2px currentColor",
                color: "transparent",
                backgroundImage: 'url("/media/eyes.jpg")',
                backgroundClip: "text",
                writingMode: "horizontal-tb",
                textWrap: "balance",
                textShadow: "0 2px 0 #000",
              },
              phone: { fontSize: "3rem" },
            },
          },
          {
            type: "image",
            name: "Sticker",
            props: { src: "/media/sticker.svg", alt: "Lookbook" },
            styles: {
              base: {
                rotate: "-14deg",
                scale: "1.1",
                translate: "0 -8%",
                transform: "skew(-6deg, 0deg)",
                transformOrigin: "50% 50%",
                clipPath: shapePresets.diagonal,
                maskImage: "linear-gradient(black 70%, transparent)",
                mixBlendMode: "multiply",
                filter: "grayscale(100%) contrast(120%)",
                backdropFilter: "blur(8px)",
                objectPosition: "30% 20%",
                gridRow: "1 / span 2",
                justifySelf: "end",
              },
              hover: { rotate: "-4deg", filter: "none" },
              tablet: { rotate: "-8deg" },
            },
          },
        ],
      },
    ]);
    expect(validatePageDocument(document, standardCatalogue).ok).toBe(true);
    expect(stylesheetOf(document)).toMatchSnapshot();
  });

  it("starts with the page’s fonts and prints styled parts of text as classes", () => {
    const document = pageWith(
      [
        {
          type: "heading",
          name: "Title",
          props: {
            text: "FREEDOM",
            level: 1,
            marks: [
              { from: 2, to: 4, styles: { fontStyle: "italic", fontWeight: "300" } },
              { from: 5, to: 6, styles: { fontStyle: "italic" } },
              { from: 6, to: 7, styles: { textStroke: "1px currentColor", color: "transparent" } },
            ],
          },
        },
      ],
      {
        fonts: [
          { source: "catalogue", id: "bebas-neue" },
          {
            source: "upload",
            family: "Studio Grotesk",
            category: "sans",
            files: [
              { src: "/media/studio.woff2", weight: "400", style: "normal", format: "woff2" },
            ],
          },
        ],
      },
    );
    expect(validatePageDocument(document, standardCatalogue).ok).toBe(true);
    expect(stylesheetOf(document)).toMatchSnapshot();
  });

  it("places a free layout’s children absolutely, and stacks them on phones", () => {
    const document = pageWith([
      {
        type: "section",
        name: "Stage",
        freeLayout: { stackOnPhone: true },
        styles: { base: { minHeight: "40rem" } },
        children: [
          { type: "heading", name: "Word", styles: { base: { left: "4%", top: "10%" } } },
          {
            type: "image",
            name: "Photo",
            styles: { base: { left: "30%", top: "20%", width: "40%", zIndex: "2" } },
          },
        ],
      },
      {
        type: "section",
        name: "Film",
        backgroundVideo: {
          src: "/media/sea.mp4",
          assetId: null,
          poster: "",
          overlay: "rgb(0 0 0 / 0.4)",
        },
      },
    ]);
    expect(validatePageDocument(document, standardCatalogue).ok).toBe(true);
    expect(stylesheetOf(document)).toMatchSnapshot();
  });

  it("refuses a free layout or video on an element that can’t have one", () => {
    const document = pageWith([{ type: "heading", freeLayout: { stackOnPhone: true } }]);
    const checked = validatePageDocument(document, standardCatalogue);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.problems[0]?.message).toMatch(/can’t have a free layout/);
  });
});

describe("shape helpers", () => {
  it("read and write polygons, and add, move and remove corners", () => {
    const points = parsePolygon("polygon(0% 0%, 100% 0%, 100% 100%, 0 100%)");
    expect(points).toHaveLength(4);
    const added = insertPointAfter(points ?? [], 1);
    expect(added[2]).toEqual({ x: 100, y: 50 });
    const moved = movePoint(added, 2, { x: 140, y: 33.333 });
    expect(polygonValue(moved)).toBe("polygon(0% 0%, 100% 0%, 100% 33.3%, 100% 100%, 0% 100%)");
    expect(removePoint(removePoint(moved, 0), 0)).toHaveLength(3);
    expect(
      removePoint(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 2, y: 0 },
        ],
        0,
      ),
    ).toHaveLength(3);
    expect(parsePolygon("circle(50%)")).toBeNull();
    expect(findShapePreset(shapePresets.circle)).toBe("circle");
  });
});

describe("background layers", () => {
  it("round-trip pictures, gradients and overlays", () => {
    const layers = [
      overlayLayer("rgb(0 0 0 / 0.4)"),
      { ...pictureLayer("/media/a.jpg"), position: "20% 70%" },
    ];
    const styles = backgroundLayerStyles(layers);
    expect(styles.backgroundImage).toBe(
      'linear-gradient(180deg, rgb(0 0 0 / 0.4) 0%, rgb(0 0 0 / 0.4) 100%), url("/media/a.jpg")',
    );
    expect(styles.backgroundAttachment).toBeUndefined();
    const read = readBackgroundLayers(styles as Record<string, string>);
    expect(read).toEqual(layers);
    expect(backgroundLayerStyles([]).backgroundImage).toBeUndefined();
  });

  it("read simple hand-written gradients", () => {
    expect(parseGradient("linear-gradient(to right, red, blue)")).toEqual({
      type: "linear",
      angle: 90,
      stops: [
        { colour: "red", at: 0 },
        { colour: "blue", at: 100 },
      ],
    });
    const radial = parseGradient("radial-gradient(circle, #fff 0%, #000 80%)");
    expect(radial && gradientValue(radial)).toBe("radial-gradient(circle, #fff 0%, #000 80%)");
    expect(parseGradient("conic-gradient(red, blue)")).toBeNull();
  });
});

describe("effect values", () => {
  it("write filters in a fixed order and leave out neutral ones", () => {
    expect(filterValue({ grayscale: "100%", blur: "4px", brightness: "100%" })).toBe(
      "blur(4px) grayscale(100%)",
    );
    expect(parseFilters("blur(4px) drop-shadow(0 2px 4px rgb(0 0 0 / 0.2))")).toEqual({
      blur: "4px",
      "drop-shadow": "0 2px 4px rgb(0 0 0 / 0.2)",
    });
    expect(parseFilters("sepia(1)")).toBeNull();
    expect(filterValue({})).toBeUndefined();
  });

  it("write skews and fluid sizes", () => {
    expect(skewValue(-8, 0)).toBe("skew(-8deg, 0deg)");
    expect(parseSkew("skew(-8deg, 0deg)")).toEqual({ x: -8, y: 0 });
    expect(skewValue(0, 0)).toBeUndefined();
    expect(fluidSize(2, 6)).toBe("clamp(2rem, 0.51rem + 6.1vw, 6rem)");
    expect(readFluidSize(fluidSize(2, 6))).toEqual({ smallest: 2, largest: 6 });
    expect(readFluidSize("2rem")).toBeNull();
  });
});
