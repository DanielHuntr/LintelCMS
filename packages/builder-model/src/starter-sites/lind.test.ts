import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import type { NodeBlueprint } from "../components/component-definition.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { listNodes } from "../tree/tree-queries.js";
import { buildStarterPage } from "./starter-site.js";
import { checkStarterSite } from "./starter-site-checks.js";
import { findStarterSite } from "./starter-sites.js";

const site = findStarterSite("lind");

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

describe("the Lind starter site", () => {
  it("passes the starter-site checks, with the plugins on and off", () => {
    if (!site) throw new Error("No Lind");
    expect(checkStarterSite(site, standardCatalogue)).toEqual([]);
    expect(checkStarterSite(site, standardCatalogue, { enabledPlugins: [] })).toEqual([]);
  });

  it("has its pages, fonts, accent and motion", () => {
    expect(site?.pages.map((page) => page.slug)).toEqual(["home", "shop", "visit"]);
    expect(site?.theme).toMatchObject({ headingFont: "Unbounded", bodyFont: "Inter" });
    expect(site?.designVariables?.map((variable) => variable.id)).toEqual(["signal"]);
    expect(site?.siteMotion).toMatchObject({
      pageTransition: { style: "wipe" },
      intro: { style: "counter", text: "Lind" },
    });
  });

  it("brings its own navigation and footer, with the Aarhus clock, and no page repeats them", () => {
    const navigation = shared(site?.siteSections?.navigation);
    const footer = shared(site?.siteSections?.footer);
    expect(navigation[0]?.props.element).toBe("header");
    expect(navigation.map((node) => node.type)).toEqual(
      expect.arrayContaining(["siteLogo", "navigation", "mobileMenu"]),
    );
    expect(footer[0]?.props.element).toBe("footer");
    expect(footer.find((node) => node.type === "clock")?.props.zone).toBe("Europe/Berlin");
    expect(footer.some((node) => node.type === "cookieSettings")).toBe(true);
    for (const page of site?.pages ?? []) {
      const elements = pageNodes(page.slug).map((node) => node.props.element);
      expect(elements, page.slug).not.toContain("header");
      expect(elements, page.slug).not.toContain("footer");
    }
  });

  it("shows the shop's products while Shop is on, and the lookbook either way", () => {
    for (const slug of ["home", "shop"]) {
      expect(
        pageNodes(slug).some((node) => node.type === "productGrid"),
        slug,
      ).toBe(true);
      expect(
        pageNodes(slug, []).some((node) => node.type === "productGrid"),
        slug,
      ).toBe(false);
    }
    const lookbook = pageNodes("home", []).find((node) => node.type === "carousel");
    expect(lookbook?.props.freeDrag).toBe(true);
    const things = pageNodes("shop", []).filter((node) => node.name === "Thing");
    expect(things).toHaveLength(6);
    expect(texts("shop")).toContain("620 kr");
  });
});
