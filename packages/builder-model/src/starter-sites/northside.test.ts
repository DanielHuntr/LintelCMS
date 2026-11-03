import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import type { NodeBlueprint } from "../components/component-definition.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { listNodes } from "../tree/tree-queries.js";
import { buildStarterPage } from "./starter-site.js";
import { checkStarterSite } from "./starter-site-checks.js";
import { findStarterSite } from "./starter-sites.js";

const site = findStarterSite("northside");

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

describe("the Northside Commons starter site", () => {
  it("passes the starter-site checks, with the plugins on and off", () => {
    if (!site) throw new Error("No Northside Commons");
    expect(checkStarterSite(site, standardCatalogue)).toEqual([]);
    expect(checkStarterSite(site, standardCatalogue, { enabledPlugins: [] })).toEqual([]);
  });

  it("has its pages, fonts, accent and motion", () => {
    expect(site?.pages.map((page) => page.slug)).toEqual([
      "home",
      "about",
      "events",
      "get-involved",
    ]);
    expect(site?.theme).toMatchObject({ headingFont: "DM Serif Display", bodyFont: "DM Sans" });
    expect(site?.designVariables?.map((variable) => variable.id)).toEqual(["harbour"]);
    expect(site?.siteMotion).toMatchObject({
      cursor: { style: "none" },
      pageTransition: { style: "fade" },
    });
  });

  it("brings its own navigation and footer, with the Dublin clock, and no page repeats them", () => {
    const navigation = shared(site?.siteSections?.navigation);
    const footer = shared(site?.siteSections?.footer);
    expect(navigation[0]?.props.element).toBe("header");
    expect(navigation.map((node) => node.type)).toEqual(
      expect.arrayContaining(["siteLogo", "navigation", "mobileMenu"]),
    );
    expect(footer[0]?.props.element).toBe("footer");
    expect(footer.find((node) => node.type === "clock")?.props.zone).toBe("Europe/Dublin");
    expect(footer.some((node) => node.type === "cookieSettings")).toBe(true);
    for (const page of site?.pages ?? []) {
      const elements = pageNodes(page.slug).map((node) => node.props.element);
      expect(elements, page.slug).not.toContain("header");
      expect(elements, page.slug).not.toContain("footer");
    }
  });

  it("says what it does, what's on and how to give money, time or food", () => {
    expect(pageNodes("events").filter((node) => node.name === "Event")).toHaveLength(5);
    const giving = pageNodes("get-involved");
    const titles = giving.filter((node) => node.type === "heading" && node.props.level === 2);
    expect(titles.map((node) => node.props.text)).toEqual(["Give money", "Give time", "Give food"]);
    expect(giving.filter((node) => node.name === "Donate button")).toHaveLength(3);
    expect(giving.some((node) => node.type === "formEmbed")).toBe(true);
    expect(pageNodes("get-involved", []).some((node) => node.type === "formEmbed")).toBe(false);
    const figures = pageNodes("home").filter((node) => node.name === "Figure");
    expect(figures.map((node) => node.effects?.[0]?.effect)).toEqual([
      "count-up",
      "count-up",
      "count-up",
    ]);
    expect(texts("home")).toContain("Neighbours looking after neighbours in Phibsborough.");
  });
});
