import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import type { PageNode } from "../document/page-document.schema.js";
import { validatePageDocument } from "../document/validate-page.js";
import { assignClassNames } from "../styles/class-names.js";
import { compileStylesheet } from "../styles/compile-stylesheet.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { createNode } from "../tree/create-node.js";
import { listNodes } from "../tree/tree-queries.js";
import { findIllustration } from "./illustrations.js";
import { buildStarterPage } from "./starter-site.js";
import { findStarterSite } from "./starter-sites.js";

const atelier = findStarterSite("atelier");

function build(slug: string) {
  const page = atelier?.pages.find((candidate) => candidate.slug === slug);
  if (!page) throw new Error(`No ${slug} page`);
  return buildStarterPage(page, standardCatalogue, createCountingNodeIds());
}

const textOf = (node: PageNode) => String(node.props.text ?? node.props.label ?? "");

describe("the Atelier starter site", () => {
  it("shows its navigation and the big Wrenfold footer on every page, not on each", () => {
    const shared = (section: Parameters<typeof createNode>[0] | undefined) =>
      section ? listNodes(createNode(section, standardCatalogue, createCountingNodeIds("s"))) : [];
    const navigation = shared(atelier?.siteSections?.navigation);
    const footer = shared(atelier?.siteSections?.footer);
    expect(navigation[0]?.props.element).toBe("header");
    expect(navigation.find((node) => node.type === "navigation")?.props.menuSource).toBe("site");
    expect(footer[0]?.props.element).toBe("footer");
    expect(footer.some((node) => node.type === "heading" && textOf(node) === "Wrenfold")).toBe(
      true,
    );
    for (const slug of ["home", "collection", "craft", "visit"]) {
      const elements = listNodes(build(slug).root).map((node) => node.props.element);
      expect(elements, slug).not.toContain("footer");
    }
  });

  it("is offered, with its own fonts and site-wide motion", () => {
    expect(atelier?.name).toBe("Atelier");
    expect(atelier?.pages.map((page) => page.slug)).toEqual([
      "home",
      "collection",
      "craft",
      "visit",
    ]);
    expect(atelier?.theme).toMatchObject({
      headingFont: "Instrument Serif",
      bodyFont: "Work Sans",
    });
    expect(atelier?.siteMotion).toMatchObject({
      smoothScroll: { strength: "strong" },
      pageTransition: { style: "slide" },
      intro: { style: "name", text: "Wrenfold" },
    });
  });

  it("builds every page into a design the server accepts", () => {
    for (const page of atelier?.pages ?? []) {
      expect(validatePageDocument(build(page.slug), standardCatalogue).ok, page.slug).toBe(true);
    }
  });

  it("opens the home page with its headline revealed letter by letter", () => {
    const nodes = listNodes(build("home").root);
    const headline = nodes.find((node) => node.type === "heading" && node.props.level === 1);
    expect(textOf(headline as PageNode)).toBe("Made slowly, kept for good");
    expect(headline?.animations?.[0]?.spec.targets).toEqual({ type: "text", split: "letters" });
    const texts = nodes.map(textOf);
    expect(texts).toContain("The collection");
    expect(texts).toContain("How a Hollin chair is made");
    expect(texts).toContain("Come and sit in them");
  });

  it("lays the collection out on the editorial grid, with places and an overlap", () => {
    const nodes = listNodes(build("home").root);
    const collection = nodes.find((node) => node.name === "Collection");
    expect(collection?.placedGrid).toEqual({ columns: 12, stackOnPhone: true });
    const placed = collection?.children.filter((child) => child.styles.base.gridColumn) ?? [];
    expect(placed.length).toBeGreaterThanOrEqual(6);
    const title = collection?.children.find((child) => child.name === "Collection title");
    expect(title?.styles.base.gridRow).toBe("1");
    expect(
      collection?.children.find((child) => child.name === "Hollin chair")?.styles.base.gridRow,
    ).toBe("2 / span 3");
  });

  it("holds the making scene on screen while its three steps slide past", () => {
    const nodes = listNodes(build("home").root);
    const scene = nodes.find((node) => node.name === "How it is made");
    const trigger = scene?.animations?.[0]?.spec.trigger;
    expect(trigger).toMatchObject({ type: "scroll", pin: { length: 2 } });
    const steps = nodes.find((node) => node.name === "Steps");
    expect(steps?.children.map((child) => child.name)).toEqual(["Step 1", "Step 2", "Step 3"]);
  });

  it("stacks the making steps down the page when motion is reduced or scripts don't run", () => {
    const page = build("home");
    const css = compileStylesheet(page.root, assignClassNames(page.root, standardCatalogue));
    const still = css.slice(
      css.indexOf("@media (prefers-reduced-motion: reduce), (scripting: none)"),
    );
    expect(still).toContain(".how-it-is-made > * > :last-child {");
    expect(still).toContain("flex-direction: column;");
    expect(still).toContain(".how-it-is-made > * > :last-child > * {");
    // With motion allowed and scripts running, the row stays three screens wide and slides.
    const motion = css.slice(0, css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(motion).toMatch(/\.steps \{[^}]*width: 300%;/);
  });

  it("uses the pointer touches: words on the cursor, pictures on hover and a drag gallery", () => {
    const home = listNodes(build("home").root);
    expect(
      home.some((node) => node.effects?.some((effect) => effect.effect === "cursor-word")),
    ).toBe(true);
    const collection = listNodes(build("collection").root);
    const slider = collection.find((node) => node.type === "carousel");
    expect(slider?.props.freeDrag).toBe(true);
    const hoverPictures = collection.flatMap((node) =>
      (node.effects ?? []).filter((effect) => effect.effect === "hover-picture"),
    );
    expect(hoverPictures).toHaveLength(6);
    for (const effect of hoverPictures) {
      const name = /illustrations\/([a-z-]+)\.svg$/.exec(String(effect.params.src))?.[1] ?? "";
      expect(findIllustration(name), name).toBeDefined();
    }
    expect(listNodes(build("visit").root).some((node) => node.type === "clock")).toBe(true);
  });

  it("describes every picture and keeps its drawings small", () => {
    for (const page of atelier?.pages ?? []) {
      for (const node of listNodes(build(page.slug).root).filter((node) => node.type === "image")) {
        expect(String(node.props.alt).length, `${page.slug}/${node.name}`).toBeGreaterThan(10);
      }
    }
    for (const name of ["atelier-workshop", "atelier-chair", "atelier-grain", "atelier-cover"]) {
      expect(findIllustration(name)?.length ?? Infinity, name).toBeLessThan(6000);
    }
  });
});
