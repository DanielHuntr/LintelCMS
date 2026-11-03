import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
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

  it("shows each project's drawing and the word View over its row on the home page", () => {
    const rows = pageNodes("home").filter((node) => node.type === "card");
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect(row.props.href).toBe("/work");
      const word = row.effects?.find((effect) => effect.effect === "cursor-word");
      const picture = row.effects?.find((effect) => effect.effect === "hover-picture");
      expect(word?.params.text).toBe("View");
      expect(row.styles.hover?.color).toBe("var(--lintel-var-cobalt)");
      const name = /illustrations\/([a-z-]+)\.svg$/.exec(String(picture?.params.src))?.[1] ?? "";
      expect(findIllustration(name), name).toBeDefined();
    }
  });

  it("has a drag gallery of drawings and the studio's clock on the contact page", () => {
    const gallery = pageNodes("work").find((node) => node.type === "carousel");
    expect(gallery?.props.freeDrag).toBe(true);
    const clock = pageNodes("contact").find((node) => node.type === "clock");
    expect(clock?.props.zone).toBe("Europe/Amsterdam");
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
