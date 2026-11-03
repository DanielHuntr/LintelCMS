import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import type { NodeBlueprint } from "../components/component-definition.js";
import { validatePageDocument } from "../document/validate-page.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { listNodes } from "../tree/tree-queries.js";
import { findIllustration } from "./illustrations.js";
import { buildStarterPage } from "./starter-site.js";
import { thresholdSite } from "./threshold.js";

const illustrationName = (src: unknown) =>
  /^\/_lintel\/illustrations\/([a-z-]+)\.svg$/.exec(String(src))?.[1] ?? "";

function build(slug: string) {
  const page = thresholdSite.pages.find((candidate) => candidate.slug === slug);
  if (!page) throw new Error(`Threshold has no ${slug} page`);
  return buildStarterPage(page, standardCatalogue, createCountingNodeIds(), {
    enabledPlugins: ["forms"],
  });
}

const pageNodes = (slug: string) => listNodes(build(slug).root);

const shared = (section: NodeBlueprint | undefined) =>
  section ? listNodes(createNode(section, standardCatalogue, createCountingNodeIds("s"))) : [];

describe("the Threshold starter site", () => {
  it("has a home, homes, area guides and valuation page, with its fonts and motion", () => {
    expect(thresholdSite.pages.map((page) => page.slug)).toEqual([
      "home",
      "homes",
      "areas",
      "valuation",
    ]);
    expect(thresholdSite.theme).toMatchObject({
      headingFont: "Fraunces",
      bodyFont: "Manrope",
      cornerStyle: "soft",
    });
    expect(thresholdSite.siteMotion).toMatchObject({
      smoothScroll: { strength: "gentle" },
      cursor: { style: "dot", colour: "brand" },
      pageTransition: { style: "zoom" },
      intro: { style: "none" },
    });
    expect(findIllustration(thresholdSite.coverIllustration)).toBeDefined();
  });

  it("builds every page into a design the server accepts, with one main heading", () => {
    for (const page of thresholdSite.pages) {
      const design = build(page.slug);
      expect(validatePageDocument(design, standardCatalogue).ok, page.slug).toBe(true);
      const mainHeadings = listNodes(design.root).filter(
        (node) => node.type === "heading" && node.props.level === 1,
      );
      expect(mainHeadings, page.slug).toHaveLength(1);
    }
  });

  it("brings its own navigation and footer, and no page repeats them", () => {
    const navigation = shared(thresholdSite.siteSections?.navigation);
    expect(navigation[0]?.props.element).toBe("header");
    expect(navigation.map((node) => node.type)).toEqual(
      expect.arrayContaining(["siteLogo", "navigation", "mobileMenu"]),
    );
    expect(navigation.find((node) => node.type === "navigation")?.props.menuSource).toBe("site");
    const footer = shared(thresholdSite.siteSections?.footer);
    expect(footer[0]?.props.element).toBe("footer");
    expect(footer.map((node) => node.type)).toContain("cookieSettings");
    for (const page of thresholdSite.pages) {
      const elements = pageNodes(page.slug).map((node) => node.props.element);
      expect(elements, page.slug).not.toContain("header");
      expect(elements, page.slug).not.toContain("footer");
    }
  });

  it("brings a Listings collection whose entries all have the fields and a real picture", () => {
    const listings = thresholdSite.collections?.find((each) => each.handle === "listings");
    expect(listings?.name).toBe("Listings");
    expect(listings?.entries).toHaveLength(6);
    const handles = listings?.fields.map((field) => field.handle) ?? [];
    expect(new Set(listings?.entries.map((entry) => entry.slug)).size).toBe(6);
    for (const entry of listings?.entries ?? []) {
      expect(Object.keys(entry.data).sort(), entry.slug).toEqual([...handles].sort());
      expect(findIllustration(illustrationName(entry.data.picture)), entry.slug).toBeDefined();
      expect(entry.data.picture_alt?.length, entry.slug).toBeGreaterThan(10);
      expect(["For sale", "To let"]).toContain(entry.data.kind);
    }
  });

  it("lists the homes from the collection, binding only fields it has", () => {
    const listings = thresholdSite.collections?.[0];
    const known = new Set([
      "title",
      ...(listings?.fields.map((field) => `data.${field.handle}`) ?? []),
    ]);
    for (const [slug, limit] of [
      ["home", 3],
      ["homes", 24],
    ] as const) {
      const nodes = pageNodes(slug);
      const list = nodes.find((node) => node.type === "collectionList");
      expect(list?.props, slug).toMatchObject({ collection: "listings", sort: "manual", limit });
      const bound = listNodes(list!).flatMap((node) => Object.values(node.bindings ?? {}));
      expect(bound, slug).toEqual(expect.arrayContaining(["title", "data.picture", "data.price"]));
      for (const path of bound) expect(known.has(path), `${slug}: ${path}`).toBe(true);
      // Entries have no page of their own, so nothing links to one.
      expect(bound, slug).not.toContain("url");
    }
  });

  it("asks for a valuation with the contact form, and keeps the phone number without Forms", () => {
    expect(pageNodes("valuation").find((node) => node.type === "formEmbed")?.props.form).toBe(
      "contact",
    );
    const page = thresholdSite.pages.find((candidate) => candidate.slug === "valuation")!;
    const withoutForms = listNodes(
      buildStarterPage(page, standardCatalogue, createCountingNodeIds()).root,
    );
    expect(withoutForms.some((node) => node.type === "formEmbed")).toBe(false);
    expect(withoutForms.some((node) => String(node.props.href).startsWith("tel:"))).toBe(true);
  });

  it("gives every picture alt text and a drawing that exists, keeps headings in order and effects few", () => {
    for (const page of thresholdSite.pages) {
      const nodes = pageNodes(page.slug);
      expect(
        nodes.some((node) => node.animations?.length),
        page.slug,
      ).toBe(true);
      for (const image of nodes.filter((node) => node.type === "image")) {
        expect(String(image.props.alt).length, page.slug).toBeGreaterThan(10);
        expect(findIllustration(illustrationName(image.props.src)), page.slug).toBeDefined();
      }
      let previous = 0;
      for (const heading of nodes.filter((node) => node.type === "heading")) {
        const level = Number(heading.props.level);
        expect(level - previous, `${page.slug}: ${String(heading.props.text)}`).toBeLessThanOrEqual(
          1,
        );
        previous = level;
      }
      const effects = nodes.reduce((total, node) => total + (node.effects?.length ?? 0), 0);
      expect(effects, page.slug).toBeLessThanOrEqual(10);
    }
  });

  it("draws every one of its pictures as a small SVG", () => {
    const names = [
      "threshold-cover",
      "threshold-crescent",
      "threshold-terrace",
      "threshold-cottage",
      "threshold-mews",
      "threshold-flat",
      "threshold-villa",
      "threshold-loft",
      "threshold-widcombe",
      "threshold-larkhall",
      "threshold-lansdown",
    ];
    for (const name of names) {
      const svg = findIllustration(name);
      expect(svg, name).toMatch(/^<svg [^>]*role="img"/);
      expect(svg!.length, name).toBeLessThan(12_000);
    }
  });
});
