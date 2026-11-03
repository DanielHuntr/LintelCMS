import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import type { NodeBlueprint } from "../components/component-definition.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { listNodes } from "../tree/tree-queries.js";
import { buildStarterPage } from "./starter-site.js";
import { checkStarterSite } from "./starter-site-checks.js";
import { findStarterSite } from "./starter-sites.js";

const site = findStarterSite("tollbooth");

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

describe("the Tollbooth starter site", () => {
  it("passes the starter-site checks, with the plugins on and off", () => {
    if (!site) throw new Error("No Tollbooth");
    expect(checkStarterSite(site, standardCatalogue)).toEqual([]);
    expect(checkStarterSite(site, standardCatalogue, { enabledPlugins: [] })).toEqual([]);
  });

  it("has its pages, fonts, accent and motion", () => {
    expect(site?.pages.map((page) => page.slug)).toEqual(["home", "menu", "story", "visit"]);
    expect(site?.theme).toMatchObject({ headingFont: "Fraunces", bodyFont: "Work Sans" });
    expect(site?.designVariables?.map((variable) => variable.id)).toEqual(["claret"]);
    expect(site?.siteMotion).toMatchObject({
      smoothScroll: { strength: "gentle" },
      pageTransition: { style: "fade" },
      intro: { style: "name", text: "Tollbooth" },
    });
  });

  it("brings its own navigation and footer, with the Edinburgh clock, and no page repeats them", () => {
    const navigation = shared(site?.siteSections?.navigation);
    const footer = shared(site?.siteSections?.footer);
    expect(navigation[0]?.props.element).toBe("header");
    expect(navigation.map((node) => node.type)).toEqual(
      expect.arrayContaining(["siteLogo", "navigation", "mobileMenu"]),
    );
    expect(footer[0]?.props.element).toBe("footer");
    expect(footer.find((node) => node.type === "clock")?.props.zone).toBe("Europe/London");
    expect(footer.some((node) => node.type === "cookieSettings")).toBe(true);
    for (const page of site?.pages ?? []) {
      const elements = pageNodes(page.slug).map((node) => node.props.element);
      expect(elements, page.slug).not.toContain("header");
      expect(elements, page.slug).not.toContain("footer");
    }
  });

  it("sets out the menu course by course, with a price on every dish", () => {
    const courses = pageNodes("menu").filter(
      (node) => node.type === "heading" && node.props.level === 2,
    );
    expect(courses.map((node) => node.props.text)).toEqual([
      "Snacks",
      "Small plates",
      "From the fire",
      "Puddings",
      "Wine",
    ]);
    const prices = pageNodes("menu").filter((node) => node.name === "Price");
    expect(prices.length).toBeGreaterThanOrEqual(13);
    for (const price of prices) expect(String(price.props.text)).toMatch(/^£\d+$/);
  });

  it("shows opening hours and a way to book, keeping the phone number when Forms is off", () => {
    expect(pageNodes("home").some((node) => node.type === "table")).toBe(true);
    expect(pageNodes("visit").find((node) => node.type === "formEmbed")?.props.form).toBe(
      "contact",
    );
    const withoutForms = pageNodes("visit", []);
    expect(withoutForms.some((node) => node.type === "formEmbed")).toBe(false);
    expect(withoutForms.some((node) => node.props.href === "tel:+441315550192")).toBe(true);
    expect(texts("home")).toContain(
      "Wood smoke, Scottish fish and one long table in the old toll house.",
    );
  });
});
