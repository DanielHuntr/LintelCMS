import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { createNode } from "../tree/create-node.js";
import { listNodes } from "../tree/tree-queries.js";
import { findIllustration } from "./illustrations.js";
import { buildStarterPage } from "./starter-site.js";
import { findStarterSite } from "./starter-sites.js";

const studio = findStarterSite("studio");

function pageNodes(slug: string) {
  const page = studio?.pages.find((candidate) => candidate.slug === slug);
  if (!page) throw new Error(`No ${slug} page`);
  return listNodes(buildStarterPage(page, standardCatalogue, createCountingNodeIds()).root);
}

describe("the Studio starter site", () => {
  it("has a home, work, studio and contact page, with its fonts and motion", () => {
    expect(studio?.pages.map((page) => page.slug)).toEqual(["home", "work", "studio", "contact"]);
    expect(studio?.theme).toMatchObject({ headingFont: "Space Grotesk", bodyFont: "Inter" });
    expect(studio?.designVariables).toEqual([
      { id: "cobalt", name: "Cobalt", kind: "colour", value: "#2447d6", darkValue: "#7d95ff" },
    ]);
    expect(studio?.siteMotion).toMatchObject({
      smoothScroll: { strength: "gentle" },
      cursor: { style: "ring", colour: "text" },
      pageTransition: { style: "fade" },
      intro: { style: "none" },
    });
  });

  it("lays every band out on the twelve-column grid", () => {
    for (const page of studio?.pages ?? []) {
      for (const section of page.sections) {
        expect(section.placedGrid, `${page.slug}/${section.name}`).toEqual({
          columns: 12,
          stackOnPhone: true,
        });
      }
    }
  });

  it("shows each project's drawing and the word View over its rows on the home page", () => {
    const nodes = pageNodes("home");
    const list = nodes.find((node) => node.name === "Project list");
    const word = list?.effects?.find((effect) => effect.effect === "cursor-word");
    expect(word?.params.text).toBe("View");
    const rows = nodes.filter((node) => node.type === "card");
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect(row.props.href).toBe("/work");
      expect(row.effects?.map((effect) => effect.effect)).toEqual(["hover-picture"]);
      const picture = row.effects?.find((effect) => effect.effect === "hover-picture");
      expect(row.styles.hover?.color).toBe("var(--lintel-var-cobalt)");
      const name = /illustrations\/([a-z-]+)\.svg$/.exec(String(picture?.params.src))?.[1] ?? "";
      expect(findIllustration(name), name).toBeDefined();
    }
  });

  it("shows its navigation and its footer (with the Rotterdam clock and cobalt) on every page", () => {
    const shared = (section: Parameters<typeof createNode>[0] | undefined) =>
      section ? listNodes(createNode(section, standardCatalogue, createCountingNodeIds("s"))) : [];
    const navigation = shared(studio?.siteSections?.navigation);
    const footer = shared(studio?.siteSections?.footer);
    expect(navigation[0]?.props.element).toBe("header");
    expect(navigation.map((node) => node.type)).toEqual(
      expect.arrayContaining(["siteLogo", "navigation", "mobileMenu"]),
    );
    expect(footer[0]?.props.element).toBe("footer");
    expect(footer.find((node) => node.type === "clock")?.props.label).toBe("Rotterdam");
    expect(JSON.stringify(footer)).toContain("var(--lintel-var-cobalt)");
    for (const page of ["home", "work", "studio", "contact"]) {
      const elements = pageNodes(page).map((node) => node.props.element);
      expect(elements, page).not.toContain("header");
      expect(elements, page).not.toContain("footer");
    }
  });

  it("has a drag gallery of drawings and the studio's clock on the contact page", () => {
    const gallery = pageNodes("work").find((node) => node.type === "carousel");
    expect(gallery?.props.freeDrag).toBe(true);
    const clock = pageNodes("contact").find((node) => node.type === "clock");
    expect(clock?.props.zone).toBe("Europe/Amsterdam");
  });

  it("leaves room under the builder's 'a lot of effects' mark (over 12) on every page (LINTEL-A11Y-027)", () => {
    for (const page of studio?.pages ?? []) {
      const count = pageNodes(page.slug).reduce(
        (total, node) => total + (node.effects?.length ?? 0),
        0,
      );
      expect(count, page.slug).toBeLessThanOrEqual(10);
    }
  });

  it("gives every picture alt text, and keeps headings in order", () => {
    for (const page of studio?.pages ?? []) {
      const nodes = pageNodes(page.slug);
      for (const image of nodes.filter((node) => node.type === "image")) {
        expect(String(image.props.alt).length, page.slug).toBeGreaterThan(10);
      }
      let previous = 0;
      for (const heading of nodes.filter((node) => node.type === "heading")) {
        const level = Number(heading.props.level);
        expect(level - previous, `${page.slug}: ${String(heading.props.text)}`).toBeLessThanOrEqual(
          1,
        );
        previous = level;
      }
    }
  });
});
