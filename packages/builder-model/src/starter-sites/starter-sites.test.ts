import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import type { NodeBlueprint } from "../components/component-definition.js";
import { validatePageDocument } from "../document/validate-page.js";
import { listNodes } from "../tree/tree-queries.js";
import { sectionCategories, sectionTemplates } from "../templates/section-templates.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { createNode } from "../tree/create-node.js";
import { findIllustration } from "./illustrations.js";
import { buildStarterPage } from "./starter-site.js";
import { findStarterSite, starterSites } from "./starter-sites.js";

function pictures(blueprint: NodeBlueprint): string[] {
  const own =
    blueprint.type === "image" && typeof blueprint.props?.src === "string"
      ? [blueprint.props.src]
      : [];
  return [...own, ...(blueprint.children ?? []).flatMap(pictures)];
}

describe("starter sites", () => {
  it("offers at least six, each with a home page and two to four others", () => {
    expect(starterSites.length).toBeGreaterThanOrEqual(6);
    for (const site of starterSites) {
      expect(site.pages[0]?.slug).toBe("home");
      expect(site.pages.length).toBeGreaterThanOrEqual(3);
      expect(site.pages.length).toBeLessThanOrEqual(5);
      expect(new Set(site.pages.map((page) => page.slug)).size).toBe(site.pages.length);
    }
  });

  it("builds every page into a design the server accepts, with one main heading", () => {
    for (const site of starterSites) {
      for (const page of site.pages) {
        const design = buildStarterPage(page, standardCatalogue, createCountingNodeIds());
        const checked = validatePageDocument(design, standardCatalogue);
        expect(checked.ok, `${site.id}/${page.slug}`).toBe(true);
        const mainHeadings = listNodes(design.root).filter(
          (node) => node.type === "heading" && node.props.level === 1,
        );
        expect(mainHeadings, `${site.id}/${page.slug}`).toHaveLength(1);
      }
    }
  });

  it("animates something on every page, and only uses illustrations that exist", () => {
    for (const site of starterSites) {
      expect(findIllustration(site.coverIllustration)).toBeDefined();
      for (const page of site.pages) {
        const design = buildStarterPage(page, standardCatalogue, createCountingNodeIds());
        expect(listNodes(design.root).some((node) => node.animations?.length)).toBe(true);
        for (const src of page.sections.flatMap(pictures)) {
          const name = /^\/_lintel\/illustrations\/([a-z-]+)\.svg$/.exec(src)?.[1] ?? "";
          expect(findIllustration(name), src).toBeDefined();
        }
      }
    }
  });

  it("gives Folio a drag gallery, a live clock, hover pictures and its own motion", () => {
    const folio = findStarterSite("folio");
    expect(folio?.siteMotion).toMatchObject({
      smoothScroll: { strength: "gentle" },
      cursor: { style: "dot" },
      pageTransition: { style: "fade" },
      intro: { style: "counter" },
    });
    expect(folio?.theme).toMatchObject({ headingFont: "Archivo", bodyFont: "Archivo" });
    const nodes = (slug: string) => {
      const page = folio?.pages.find((candidate) => candidate.slug === slug);
      if (!page) throw new Error(`Folio has no ${slug} page`);
      return listNodes(buildStarterPage(page, standardCatalogue, createCountingNodeIds()).root);
    };
    const home = nodes("home");
    const gallery = home.find((node) => node.type === "carousel");
    expect(gallery?.props).toMatchObject({ freeDrag: true, showDots: false });
    expect(gallery?.effects).toEqual([{ effect: "cursor-word", params: { text: "Drag" } }]);
    expect(home.some((node) => node.placedGrid?.columns === 12)).toBe(true);
    // The navigation (with the Lisbon clock) and the footer are the site's, on every page,
    // so no page keeps a copy.
    const shared = (section: NodeBlueprint | undefined) =>
      section ? listNodes(createNode(section, standardCatalogue, createCountingNodeIds("s"))) : [];
    const navigation = shared(folio?.siteSections?.navigation);
    expect(navigation[0]?.props.element).toBe("header");
    expect(navigation.find((node) => node.type === "clock")?.props.zone).toBe("Europe/Lisbon");
    expect(navigation.find((node) => node.type === "navigation")?.props.menuSource).toBe("site");
    expect(shared(folio?.siteSections?.footer)[0]?.props.element).toBe("footer");
    for (const slug of ["home", "projects", "about", "contact"]) {
      const top = nodes(slug).filter((node) => node.type === "section");
      expect(
        top.map((node) => node.props.element),
        slug,
      ).not.toContain("header");
      expect(
        top.map((node) => node.props.element),
        slug,
      ).not.toContain("footer");
    }
    const rows = nodes("projects").filter((node) => node.name === "Project");
    expect(rows).toHaveLength(8);
    for (const row of rows) {
      const src = row.effects?.find((effect) => effect.effect === "hover-picture")?.params.src;
      const name = /^\/_lintel\/illustrations\/([a-z-]+)\.svg$/.exec(String(src))?.[1] ?? "";
      expect(findIllustration(name), String(src)).toBeDefined();
    }
  });

  it("finds a starter site by its id", () => {
    expect(findStarterSite("bakery")?.name).toBe("Bakery and café");
    expect(findStarterSite("nope")).toBeUndefined();
  });
});

describe("the section library", () => {
  it("groups sections by what they're for, never by a kind of business", () => {
    const categories = new Set(sectionTemplates.map((template) => template.category));
    expect([...categories]).toEqual([...sectionCategories]);
    expect(new Set(sectionTemplates.map((template) => template.id)).size).toBe(
      sectionTemplates.length,
    );
    const businesses = starterSites.map((site) => site.name.toLowerCase());
    for (const template of sectionTemplates) {
      for (const business of businesses) {
        expect(template.label.toLowerCase(), template.id).not.toContain(business);
      }
    }
    const openingTimes = sectionTemplates.find((template) => template.id === "opening-times");
    expect(openingTimes?.category).toBe("contact");
    expect(openingTimes?.keywords).toContain("bakery");
  });

  it("only holds sections the server accepts", () => {
    for (const template of sectionTemplates) {
      const design = buildStarterPage(
        { slug: "x", title: "x", summary: "", sections: [template.blueprint] },
        standardCatalogue,
        createCountingNodeIds(),
        { enabledPlugins: ["commerce", "forms"] },
      );
      expect(design.root.children, template.id).toHaveLength(1);
      expect(validatePageDocument(design, standardCatalogue).ok, template.id).toBe(true);
    }
  });
});
