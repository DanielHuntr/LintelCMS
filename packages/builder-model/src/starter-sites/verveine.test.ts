import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import type { NodeBlueprint } from "../components/component-definition.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { listNodes } from "../tree/tree-queries.js";
import { buildStarterPage } from "./starter-site.js";
import { checkStarterSite } from "./starter-site-checks.js";
import { findStarterSite } from "./starter-sites.js";

const site = findStarterSite("verveine");

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

describe("the Verveine starter site", () => {
  it("passes the starter-site checks, with the plugins on and off", () => {
    if (!site) throw new Error("No Verveine");
    expect(checkStarterSite(site, standardCatalogue)).toEqual([]);
    expect(checkStarterSite(site, standardCatalogue, { enabledPlugins: [] })).toEqual([]);
  });

  it("has its pages, fonts, accent and motion", () => {
    expect(site?.pages.map((page) => page.slug)).toEqual([
      "home",
      "weddings",
      "stories",
      "enquire",
    ]);
    expect(site?.theme).toMatchObject({ headingFont: "Playfair Display", bodyFont: "Manrope" });
    expect(site?.designVariables?.map((variable) => variable.id)).toEqual(["sage"]);
    expect(site?.siteMotion).toMatchObject({
      smoothScroll: { strength: "strong" },
      intro: { style: "curtain" },
    });
  });

  it("brings its own navigation and footer, with the Aix clock, and no page repeats them", () => {
    const navigation = shared(site?.siteSections?.navigation);
    const footer = shared(site?.siteSections?.footer);
    expect(navigation[0]?.props.element).toBe("header");
    expect(navigation.map((node) => node.type)).toEqual(
      expect.arrayContaining(["siteLogo", "navigation", "mobileMenu"]),
    );
    expect(footer[0]?.props.element).toBe("footer");
    expect(footer.find((node) => node.type === "clock")?.props.zone).toBe("Europe/Paris");
    expect(footer.some((node) => node.type === "cookieSettings")).toBe(true);
    for (const page of site?.pages ?? []) {
      const elements = pageNodes(page.slug).map((node) => node.props.element);
      expect(elements, page.slug).not.toContain("header");
      expect(elements, page.slug).not.toContain("footer");
    }
  });

  it("has a gallery to drag through, three ways to help with prices and an enquiry form", () => {
    const gallery = pageNodes("home").find((node) => node.type === "carousel");
    expect(gallery?.props).toMatchObject({ freeDrag: true, showDots: false });
    expect(gallery?.effects?.[0]).toEqual({ effect: "cursor-word", params: { text: "Drag" } });
    const offers = pageNodes("weddings").filter((node) => node.name === "Offer");
    expect(offers.map((node) => node.props.text)).toEqual([
      "Full planning",
      "Partial planning",
      "On the day",
    ]);
    expect(pageNodes("enquire").some((node) => node.type === "formEmbed")).toBe(true);
    expect(pageNodes("enquire", []).some((node) => node.type === "formEmbed")).toBe(false);
    expect(texts("home")).toContain(
      "Weddings in Provence, planned like a long lunch with friends.",
    );
  });
});
