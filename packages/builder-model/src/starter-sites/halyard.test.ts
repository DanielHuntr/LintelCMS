import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import type { NodeBlueprint } from "../components/component-definition.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { listNodes } from "../tree/tree-queries.js";
import { buildStarterPage } from "./starter-site.js";
import { checkStarterSite } from "./starter-site-checks.js";
import { findStarterSite } from "./starter-sites.js";

const site = findStarterSite("halyard");

function pageNodes(slug: string, enabledPlugins: readonly string[] = ["commerce", "forms"]) {
  const page = site?.pages.find((candidate) => candidate.slug === slug);
  if (!page) throw new Error(`No ${slug} page`);
  return listNodes(
    buildStarterPage(page, standardCatalogue, createCountingNodeIds(), { enabledPlugins }).root,
  );
}

const shared = (section: NodeBlueprint | undefined) =>
  section ? listNodes(createNode(section, standardCatalogue, createCountingNodeIds("s"))) : [];

const texts = (slug: string) =>
  pageNodes(slug).map((node) => String(node.props.text ?? node.props.label ?? ""));

describe("the Halyard starter site", () => {
  it("passes the starter-site checks, with the plugins on and off", () => {
    if (!site) throw new Error("No Halyard");
    expect(checkStarterSite(site, standardCatalogue)).toEqual([]);
    expect(checkStarterSite(site, standardCatalogue, { enabledPlugins: [] })).toEqual([]);
  });

  it("has its pages, fonts, accent and motion", () => {
    expect(site?.pages.map((page) => page.slug)).toEqual([
      "home",
      "timetable",
      "classes",
      "memberships",
    ]);
    expect(site?.theme).toMatchObject({
      headingFont: "Big Shoulders Display",
      bodyFont: "Archivo",
    });
    expect(site?.designVariables?.map((variable) => variable.id)).toEqual(["lime"]);
    expect(site?.siteMotion).toMatchObject({
      cursor: { style: "blend" },
      pageTransition: { style: "zoom" },
    });
  });

  it("brings its own navigation and footer, with the Cape Town clock, and no page repeats them", () => {
    const navigation = shared(site?.siteSections?.navigation);
    const footer = shared(site?.siteSections?.footer);
    expect(navigation[0]?.props.element).toBe("header");
    expect(navigation.map((node) => node.type)).toEqual(
      expect.arrayContaining(["siteLogo", "navigation", "mobileMenu"]),
    );
    expect(footer[0]?.props.element).toBe("footer");
    expect(footer.find((node) => node.type === "clock")?.props.zone).toBe("Africa/Johannesburg");
    expect(footer.some((node) => node.type === "cookieSettings")).toBe(true);
    for (const page of site?.pages ?? []) {
      const elements = pageNodes(page.slug).map((node) => node.props.element);
      expect(elements, page.slug).not.toContain("header");
      expect(elements, page.slug).not.toContain("footer");
    }
  });

  it("counts as many classes on the home page as the timetable shows", () => {
    const sessions = pageNodes("timetable")
      .filter((node) => node.type === "table")
      .flatMap((node) => node.props.rows as unknown[]);
    const figure = pageNodes("home").find((node) => node.name === "Figure");
    expect(String(sessions.length)).toBe(figure?.props.text);
  });

  it("has a timetable for every day, classes with pictures on hover and three memberships", () => {
    const days = pageNodes("timetable").filter((node) => node.type === "table");
    expect(days).toHaveLength(7);
    for (const day of days) expect(day.props.headings).toEqual(["Time", "Class", "Coach"]);
    const rows = pageNodes("home").filter((node) => node.name === "Class");
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.effects?.map((effect) => effect.effect)).toEqual(["hover-picture"]);
    }
    expect(pageNodes("memberships").filter((node) => node.name === "Membership")).toHaveLength(3);
    expect(texts("home")).toContain("Get strong. Stay supple.");
  });
});
