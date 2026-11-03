import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import type { NodeBlueprint } from "../components/component-definition.js";
import { validatePageDocument } from "../document/validate-page.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { createNode } from "../tree/create-node.js";
import { listNodes } from "../tree/tree-queries.js";
import { findIllustration } from "./illustrations.js";
import { longplayIllustrations } from "./illustrations-longplay.js";
import { longplaySite } from "./longplay.js";
import { buildStarterPage, type StarterPageOptions } from "./starter-site.js";

const withForms: StarterPageOptions = { enabledPlugins: ["forms"] };

function build(slug: string, options: StarterPageOptions = withForms) {
  const page = longplaySite.pages.find((candidate) => candidate.slug === slug);
  if (!page) throw new Error(`Longplay has no ${slug} page`);
  return buildStarterPage(page, standardCatalogue, createCountingNodeIds(), options);
}

const nodes = (slug: string) => listNodes(build(slug).root);
const shared = (section: NodeBlueprint | undefined) =>
  section ? listNodes(createNode(section, standardCatalogue, createCountingNodeIds("s"))) : [];
const texts = (slug: string) =>
  nodes(slug).map((node) => String(node.props.text ?? node.props.label ?? ""));

describe("the Longplay starter site", () => {
  it("has a home, music, tour and mailing list page, with Anton, Space Mono and its motion", () => {
    expect(longplaySite.pages.map((page) => page.slug)).toEqual([
      "home",
      "music",
      "tour",
      "mailing-list",
    ]);
    expect(longplaySite.theme).toMatchObject({ headingFont: "Anton", bodyFont: "Space Mono" });
    expect(longplaySite.siteMotion).toMatchObject({
      smoothScroll: { strength: "strong" },
      cursor: { style: "blend" },
      pageTransition: { style: "wipe" },
      intro: { style: "name", text: "Halfway Lights" },
    });
  });

  it("builds every page into a design the server accepts, with or without Forms", () => {
    for (const page of longplaySite.pages) {
      for (const options of [withForms, {}]) {
        const design = build(page.slug, options);
        expect(validatePageDocument(design, standardCatalogue).ok, page.slug).toBe(true);
        const mainHeadings = listNodes(design.root).filter(
          (node) => node.type === "heading" && node.props.level === 1,
        );
        expect(mainHeadings, page.slug).toHaveLength(1);
        expect(
          listNodes(design.root).some((node) => node.animations?.length),
          page.slug,
        ).toBe(true);
      }
    }
  });

  it("opens with the band's name, the new record, a video and the next shows", () => {
    const home = texts("home");
    expect(home).toContain("Halfway Lights");
    expect(home).toContain("Salt Lines");
    expect(home).toContain("On tour in March");
    const video = nodes("home").find((node) => node.type === "video");
    expect(video?.props).toMatchObject({ source: "youtube", title: "Kingsway, live at the Mill" });
    const poster = nodes("home").find((node) => node.name === "Video poster");
    expect(poster?.props.src).toBe("/_lintel/illustrations/longplay-stage.svg");
    expect(nodes("home").find((node) => node.type === "marquee")).toBeDefined();
    expect(nodes("home").filter((node) => node.name === "Show")).toHaveLength(3);
  });

  it("lists eight tour dates, with tickets or Sold out on each", () => {
    const shows = nodes("tour").filter((node) => node.name === "Show");
    expect(shows).toHaveLength(8);
    const tour = texts("tour");
    expect(tour).toContain("Fri 12 Mar");
    expect(tour).toContain("Manchester");
    expect(tour.filter((words) => words === "Sold out")).toHaveLength(2);
    const tickets = nodes("tour").filter((node) => node.type === "button");
    expect(tickets).toHaveLength(6);
    expect(tickets.map((node) => node.props.label)).toContain("Last few");
  });

  it("has a drag gallery and a sleeve under the pointer on each release", () => {
    const music = nodes("music");
    const gallery = music.find((node) => node.type === "carousel");
    expect(gallery?.props.freeDrag).toBe(true);
    expect(gallery?.effects).toEqual([{ effect: "cursor-word", params: { text: "Drag" } }]);
    const rows = music.filter((node) => node.name === "Release");
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      const src = row.effects?.find((effect) => effect.effect === "hover-picture")?.params.src;
      const name = /illustrations\/([a-z-]+)\.svg$/.exec(String(src))?.[1] ?? "";
      expect(findIllustration(name), name).toBeDefined();
    }
  });

  it("asks people onto the mailing list with the newsletter form", () => {
    const signup = nodes("mailing-list").find((node) => node.type === "newsletterSignup");
    expect(signup?.props).toMatchObject({ form: "newsletter", buttonLabel: "Sign me up" });
    expect(texts("mailing-list")).toContain("Letters from the van");
  });

  it("shows its own navigation and footer on every page, and no page repeats them", () => {
    const navigation = shared(longplaySite.siteSections?.navigation);
    const footer = shared(longplaySite.siteSections?.footer);
    expect(navigation[0]?.props.element).toBe("header");
    expect(navigation.map((node) => node.type)).toEqual(
      expect.arrayContaining(["siteLogo", "navigation", "mobileMenu"]),
    );
    expect(navigation.find((node) => node.type === "navigation")?.props.menuSource).toBe("site");
    expect(footer[0]?.props.element).toBe("footer");
    expect(footer.some((node) => node.type === "cookieSettings")).toBe(true);
    for (const page of longplaySite.pages) {
      const elements = nodes(page.slug).map((node) => node.props.element);
      expect(elements, page.slug).not.toContain("header");
      expect(elements, page.slug).not.toContain("footer");
    }
  });

  it("gives every picture alt text, keeps headings in order and effects few", () => {
    for (const page of longplaySite.pages) {
      const all = nodes(page.slug);
      for (const image of all.filter((node) => node.type === "image")) {
        expect(String(image.props.alt).length, page.slug).toBeGreaterThan(10);
        const name = /illustrations\/([a-z-]+)\.svg$/.exec(String(image.props.src))?.[1] ?? "";
        expect(findIllustration(name), name).toBeDefined();
      }
      let previous = 0;
      for (const heading of all.filter((node) => node.type === "heading")) {
        const level = Number(heading.props.level);
        expect(level - previous, `${page.slug}: ${String(heading.props.text)}`).toBeLessThanOrEqual(
          1,
        );
        previous = level;
      }
      const effects = all.reduce((total, node) => total + (node.effects?.length ?? 0), 0);
      expect(effects, page.slug).toBeLessThanOrEqual(10);
    }
  });

  it("draws its own pictures, all of them small SVGs", () => {
    expect(findIllustration(longplaySite.coverIllustration)).toBeDefined();
    for (const [name, drawing] of Object.entries(longplayIllustrations)) {
      expect(name.startsWith("longplay-"), name).toBe(true);
      expect(drawing.startsWith("<svg"), name).toBe(true);
      expect(drawing.length, name).toBeLessThan(12_000);
    }
  });
});
