import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import type { NodeBlueprint } from "../components/component-definition.js";
import { validatePageDocument } from "../document/validate-page.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { createNode } from "../tree/create-node.js";
import { listNodes } from "../tree/tree-queries.js";
import { findIllustration } from "./illustrations.js";
import { relaySite } from "./relay.js";
import { buildStarterPage } from "./starter-site.js";

const slugs = ["home", "pricing", "updates", "start"];

function design(slug: string) {
  const page = relaySite.pages.find((candidate) => candidate.slug === slug);
  if (!page) throw new Error(`Relay has no ${slug} page`);
  return buildStarterPage(page, standardCatalogue, createCountingNodeIds(), {
    enabledPlugins: ["forms"],
    forms: { contact: "contact" },
  });
}

const pageNodes = (slug: string) => listNodes(design(slug).root);

const shared = (section: NodeBlueprint | undefined) =>
  section ? listNodes(createNode(section, standardCatalogue, createCountingNodeIds("s"))) : [];

describe("the Relay starter site", () => {
  it("has a home, pricing, updates and sign-up page, with its fonts and motion", () => {
    expect(relaySite.pages.map((page) => page.slug)).toEqual(slugs);
    expect(relaySite.theme).toMatchObject({ headingFont: "Manrope", bodyFont: "Manrope" });
    expect(relaySite.siteMotion).toMatchObject({
      smoothScroll: { strength: "gentle" },
      cursor: { style: "ring-and-dot" },
      pageTransition: { style: "slide" },
      intro: { style: "curtain" },
    });
    expect(findIllustration(relaySite.coverIllustration)).toBeDefined();
  });

  it("builds every page into a design the server accepts, with one main heading", () => {
    for (const slug of slugs) {
      const built = design(slug);
      expect(validatePageDocument(built, standardCatalogue).ok, slug).toBe(true);
      const mainHeadings = listNodes(built.root).filter(
        (node) => node.type === "heading" && node.props.level === 1,
      );
      expect(mainHeadings, slug).toHaveLength(1);
    }
  });

  it("shows the headline, the features and the free month on the home page", () => {
    const texts = pageNodes("home").map((node) => String(node.props.text ?? node.props.label));
    expect(texts).toContain("The rota, sorted before the van leaves.");
    expect(texts).toContain("Swaps without the group chat");
    expect(texts).toContain("Start a free month");
  });

  it("lays the home page's features out on the twelve-column grid", () => {
    const features = pageNodes("home").find((node) => node.name === "What it does");
    expect(features?.placedGrid).toEqual({ columns: 12, stackOnPhone: true });
    const placed = features?.children.filter((child) => child.styles.base.gridColumn) ?? [];
    expect(placed.length).toBeGreaterThanOrEqual(8);
  });

  it("has three plans and questions on the pricing page, and a release log of updates", () => {
    const pricing = pageNodes("pricing");
    expect(pricing.filter((node) => node.props.element === "article")).toHaveLength(3);
    expect(pricing.filter((node) => node.type === "accordionItem")).toHaveLength(5);
    const releases = pageNodes("updates").find((node) => node.name === "Releases");
    expect(releases?.children).toHaveLength(6);
  });

  it("leaves the sign-up form out while Forms is switched off", () => {
    const page = relaySite.pages.find((candidate) => candidate.slug === "start");
    if (!page) throw new Error("No start page");
    const without = listNodes(
      buildStarterPage(page, standardCatalogue, createCountingNodeIds()).root,
    );
    expect(without.some((node) => node.type === "formEmbed")).toBe(false);
    expect(pageNodes("start").some((node) => node.type === "formEmbed")).toBe(true);
  });

  it("shows its navigation and footer on every page, and no page keeps a copy", () => {
    const navigation = shared(relaySite.siteSections?.navigation);
    expect(navigation[0]?.props.element).toBe("header");
    expect(navigation.map((node) => node.type)).toEqual(
      expect.arrayContaining(["siteLogo", "navigation", "mobileMenu"]),
    );
    expect(navigation.find((node) => node.type === "navigation")?.props.menuSource).toBe("site");
    expect(shared(relaySite.siteSections?.footer)[0]?.props.element).toBe("footer");
    for (const slug of slugs) {
      const elements = pageNodes(slug).map((node) => node.props.element);
      expect(elements, slug).not.toContain("header");
      expect(elements, slug).not.toContain("footer");
    }
  });

  it("animates every page, with room under the 'a lot of effects' mark", () => {
    for (const slug of slugs) {
      const nodes = pageNodes(slug);
      expect(
        nodes.some((node) => node.animations?.length),
        slug,
      ).toBe(true);
      const effects = nodes.reduce((total, node) => total + (node.effects?.length ?? 0), 0);
      expect(effects, slug).toBeLessThanOrEqual(10);
    }
  });

  it("gives every picture alt text and a drawing that exists, and keeps headings in order", () => {
    for (const slug of slugs) {
      const nodes = pageNodes(slug);
      for (const image of nodes.filter((node) => node.type === "image")) {
        expect(String(image.props.alt).length, slug).toBeGreaterThan(10);
        const name = /illustrations\/([a-z-]+)\.svg$/.exec(String(image.props.src))?.[1] ?? "";
        expect(findIllustration(name), name).toBeDefined();
      }
      let previous = 0;
      for (const heading of nodes.filter((node) => node.type === "heading")) {
        const level = Number(heading.props.level);
        expect(level - previous, `${slug}: ${String(heading.props.text)}`).toBeLessThanOrEqual(1);
        previous = level;
      }
    }
  });
});
