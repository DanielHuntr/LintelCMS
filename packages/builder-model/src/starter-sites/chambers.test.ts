import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import type { NodeBlueprint } from "../components/component-definition.js";
import { validatePageDocument } from "../document/validate-page.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { listNodes } from "../tree/tree-queries.js";
import { chambersSite } from "./chambers.js";
import { findIllustration } from "./illustrations.js";
import { buildStarterPage } from "./starter-site.js";

const slugs = ["home", "services", "team", "contact"];

function build(slug: string, enabledPlugins: string[] = []) {
  const page = chambersSite.pages.find((candidate) => candidate.slug === slug);
  if (!page) throw new Error(`Chambers has no ${slug} page`);
  return buildStarterPage(page, standardCatalogue, createCountingNodeIds(), { enabledPlugins });
}

const nodesOf = (slug: string, enabledPlugins: string[] = []) =>
  listNodes(build(slug, enabledPlugins).root);

function shared(section: NodeBlueprint | undefined) {
  return section
    ? listNodes(createNode(section, standardCatalogue, createCountingNodeIds("s")))
    : [];
}

describe("the Chambers starter site", () => {
  it("has a home, services, team and contact page, with its fonts and quiet motion", () => {
    expect(chambersSite.pages.map((page) => page.slug)).toEqual(slugs);
    expect(chambersSite.theme).toMatchObject({
      headingFont: "DM Serif Display",
      bodyFont: "DM Sans",
      cornerStyle: "soft",
    });
    expect(chambersSite.siteMotion).toMatchObject({
      smoothScroll: { strength: "gentle" },
      cursor: { style: "none" },
      pageTransition: { style: "fade", duration: 300 },
      intro: { style: "none" },
    });
    expect(findIllustration(chambersSite.coverIllustration)).toBeDefined();
  });

  it("builds every page into a design the server accepts, with one main heading", () => {
    for (const slug of slugs) {
      for (const plugins of [[], ["forms"]]) {
        const design = build(slug, plugins);
        expect(validatePageDocument(design, standardCatalogue).ok, slug).toBe(true);
        const main = listNodes(design.root).filter(
          (node) => node.type === "heading" && node.props.level === 1,
        );
        expect(main, slug).toHaveLength(1);
      }
    }
  });

  it("shows its own navigation and footer on every page, and no page repeats them", () => {
    const navigation = shared(chambersSite.siteSections?.navigation);
    expect(navigation[0]?.props.element).toBe("header");
    expect(navigation.map((node) => node.type)).toEqual(
      expect.arrayContaining(["siteLogo", "navigation", "mobileMenu"]),
    );
    expect(navigation.find((node) => node.type === "navigation")?.props.menuSource).toBe("site");
    const footer = shared(chambersSite.siteSections?.footer);
    expect(footer[0]?.props.element).toBe("footer");
    expect(JSON.stringify(footer)).toContain("0131 496 0712");
    for (const slug of slugs) {
      const elements = nodesOf(slug).map((node) => node.props.element);
      expect(elements, slug).not.toContain("header");
      expect(elements, slug).not.toContain("footer");
    }
  });

  it("lays the page tops out on the twelve-column grid", () => {
    for (const page of chambersSite.pages) {
      expect(page.sections[0]?.placedGrid, page.slug).toEqual({ columns: 12, stackOnPhone: true });
    }
  });

  it("says who the firm is on the home page and lists four services with drawings on hover", () => {
    const home = nodesOf("home");
    const texts = home.map((node) => String(node.props.text ?? node.props.label ?? ""));
    expect(texts).toContain("Clear advice for the things that matter at home and at work.");
    expect(texts).toContain("Book a first meeting");
    const rows = home.filter((node) => node.name === "Service");
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      const src = row.effects?.find((effect) => effect.effect === "hover-picture")?.params.src;
      const name = /illustrations\/([a-z-]+)\.svg$/.exec(String(src))?.[1] ?? "";
      expect(findIllustration(name), name).toBeDefined();
    }
  });

  it("gives each service plain fees, and the contact page a form only when Forms is on", () => {
    const fees = nodesOf("services").filter((node) => node.name === "Fee");
    expect(fees).toHaveLength(16);
    expect(nodesOf("contact").some((node) => node.type === "formEmbed")).toBe(false);
    const form = nodesOf("contact", ["forms"]).find((node) => node.type === "formEmbed");
    expect(form?.props.form).toBe("contact");
  });

  it("keeps effects light, pictures described and headings in order on every page", () => {
    for (const slug of slugs) {
      const nodes = nodesOf(slug, ["forms"]);
      const effects = nodes.reduce((total, node) => total + (node.effects?.length ?? 0), 0);
      expect(effects, slug).toBeLessThanOrEqual(10);
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
