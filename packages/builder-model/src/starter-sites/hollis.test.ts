import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import type { NodeBlueprint } from "../components/component-definition.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { listNodes } from "../tree/tree-queries.js";
import { buildStarterPage } from "./starter-site.js";
import { checkStarterSite } from "./starter-site-checks.js";
import { findStarterSite } from "./starter-sites.js";

const site = findStarterSite("hollis");

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

describe("the Hollis starter site", () => {
  it("passes the starter-site checks, with the plugins on and off", () => {
    if (!site) throw new Error("No Hollis");
    expect(checkStarterSite(site, standardCatalogue)).toEqual([]);
    expect(checkStarterSite(site, standardCatalogue, { enabledPlugins: [] })).toEqual([]);
  });

  it("has its pages, fonts, accent and motion", () => {
    expect(site?.pages.map((page) => page.slug)).toEqual(["home", "services", "team", "visit"]);
    expect(site?.theme).toMatchObject({ headingFont: "Syne", bodyFont: "DM Sans" });
    expect(site?.designVariables?.map((variable) => variable.id)).toEqual(["rosewood"]);
    expect(site?.siteMotion).toMatchObject({
      cursor: { style: "ring" },
      pageTransition: { style: "slide" },
    });
  });

  it("brings its own navigation and footer, with the Melbourne clock, and no page repeats them", () => {
    const navigation = shared(site?.siteSections?.navigation);
    const footer = shared(site?.siteSections?.footer);
    expect(navigation[0]?.props.element).toBe("header");
    expect(navigation.map((node) => node.type)).toEqual(
      expect.arrayContaining(["siteLogo", "navigation", "mobileMenu"]),
    );
    expect(footer[0]?.props.element).toBe("footer");
    expect(footer.find((node) => node.type === "clock")?.props.zone).toBe("Australia/Melbourne");
    expect(footer.some((node) => node.type === "cookieSettings")).toBe(true);
    for (const page of site?.pages ?? []) {
      const elements = pageNodes(page.slug).map((node) => node.props.element);
      expect(elements, page.slug).not.toContain("header");
      expect(elements, page.slug).not.toContain("footer");
    }
  });

  it("lists services with prices, the four of the team and a booking link on every page", () => {
    const prices = pageNodes("services").filter((node) => node.name === "Price");
    expect(prices.length).toBeGreaterThanOrEqual(11);
    const team = pageNodes("team").filter((node) => node.name === "Person");
    expect(team).toHaveLength(4);
    const booking = shared(site?.siteSections?.navigation).find((node) => node.type === "button");
    expect(booking?.props.href).toBe("https://hollis.example/book");
    expect(texts("home")).toContain("Cuts, colour and skin, done slowly on Gertrude Street.");
  });
});
