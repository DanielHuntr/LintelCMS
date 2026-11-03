import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import type { NodeBlueprint } from "../components/component-definition.js";
import { validatePageDocument } from "../document/validate-page.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { createNode } from "../tree/create-node.js";
import { listNodes } from "../tree/tree-queries.js";
import { findIllustration } from "./illustrations.js";
import { longwaveIllustrations } from "./illustrations-longwave.js";
import { longwaveSite } from "./longwave.js";
import { buildStarterPage } from "./starter-site.js";

function pageNodes(slug: string) {
  const page = longwaveSite.pages.find((candidate) => candidate.slug === slug);
  if (!page) throw new Error(`Longwave has no ${slug} page`);
  return listNodes(buildStarterPage(page, standardCatalogue, createCountingNodeIds()).root);
}

function shared(section: NodeBlueprint | undefined) {
  return section
    ? listNodes(createNode(section, standardCatalogue, createCountingNodeIds("s")))
    : [];
}

const illustrationAddress = /^\/_lintel\/illustrations\/([a-z-]+)\.svg$/;

describe("the Longwave starter site", () => {
  it("has a home, episodes, hosts and listen page, with its fonts and motion", () => {
    expect(longwaveSite.pages.map((page) => page.slug)).toEqual([
      "home",
      "episodes",
      "hosts",
      "listen",
    ]);
    expect(longwaveSite.theme).toMatchObject({ headingFont: "Syne", bodyFont: "DM Sans" });
    expect(longwaveSite.siteMotion).toMatchObject({
      smoothScroll: { strength: "gentle" },
      cursor: { style: "ring" },
      pageTransition: { style: "slide" },
      intro: { style: "name", text: "Second Hands" },
    });
    expect(findIllustration(longwaveSite.coverIllustration)).toBeDefined();
  });

  it("builds every page into a design the server accepts, with one main heading in order", () => {
    for (const page of longwaveSite.pages) {
      const design = buildStarterPage(page, standardCatalogue, createCountingNodeIds());
      expect(validatePageDocument(design, standardCatalogue).ok, page.slug).toBe(true);
      const nodes = listNodes(design.root);
      const headings = nodes.filter((node) => node.type === "heading");
      expect(
        headings.filter((node) => node.props.level === 1),
        page.slug,
      ).toHaveLength(1);
      let previous = 0;
      for (const heading of headings) {
        const level = Number(heading.props.level);
        expect(level - previous, `${page.slug}: ${String(heading.props.text)}`).toBeLessThanOrEqual(
          1,
        );
        previous = level;
      }
      expect(
        nodes.some((node) => node.animations?.length),
        page.slug,
      ).toBe(true);
    }
  });

  it("gives every picture alt text and only uses its own drawings", () => {
    for (const page of longwaveSite.pages) {
      for (const image of pageNodes(page.slug).filter((node) => node.type === "image")) {
        expect(String(image.props.alt).length, page.slug).toBeGreaterThan(10);
        const name = illustrationAddress.exec(String(image.props.src))?.[1] ?? "";
        expect(findIllustration(name), String(image.props.src)).toBeDefined();
      }
    }
    for (const svg of Object.values(longwaveIllustrations)) {
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg.length).toBeLessThan(8000);
    }
  });

  it("keeps effects few on every page", () => {
    for (const page of longwaveSite.pages) {
      const count = pageNodes(page.slug).reduce(
        (total, node) => total + (node.effects?.length ?? 0),
        0,
      );
      expect(count, page.slug).toBeLessThanOrEqual(10);
    }
  });

  it("shows its navigation and footer on every page, and no page keeps a copy", () => {
    const navigation = shared(longwaveSite.siteSections?.navigation);
    expect(navigation[0]?.props.element).toBe("header");
    expect(navigation.map((node) => node.type)).toEqual(
      expect.arrayContaining(["siteLogo", "navigation", "mobileMenu"]),
    );
    expect(navigation.find((node) => node.type === "navigation")?.props.menuSource).toBe("site");
    const footer = shared(longwaveSite.siteSections?.footer);
    expect(footer[0]?.props.element).toBe("footer");
    expect(JSON.stringify(footer)).toContain("Pocket Casts");
    for (const page of longwaveSite.pages) {
      const elements = pageNodes(page.slug).map((node) => node.props.element);
      expect(elements, page.slug).not.toContain("header");
      expect(elements, page.slug).not.toContain("footer");
    }
  });

  it("brings an Episodes collection with sample episodes whose covers exist", () => {
    const episodes = longwaveSite.collections?.find(
      (collection) => collection.handle === "episodes",
    );
    expect(episodes?.name).toBe("Episodes");
    expect(episodes?.entries.length).toBeGreaterThanOrEqual(6);
    const handles = new Set(episodes?.fields.map((field) => field.handle));
    for (const entry of episodes?.entries ?? []) {
      expect(Object.keys(entry.data).every((handle) => handles.has(handle))).toBe(true);
      const name = illustrationAddress.exec(entry.data.picture ?? "")?.[1] ?? "";
      expect(findIllustration(name), entry.title).toBeDefined();
      expect((entry.data.picture_alt ?? "").length).toBeGreaterThan(10);
    }
    expect(new Set(episodes?.entries.map((entry) => entry.slug)).size).toBe(
      episodes?.entries.length,
    );
  });

  it("lists the episodes from the collection, bound only to fields it has", () => {
    const episodes = longwaveSite.collections?.[0];
    const list = pageNodes("episodes").find((node) => node.type === "collectionList");
    expect(list?.props).toMatchObject({ collection: "episodes", sort: "manual" });
    const own = new Set([
      "title",
      ...(episodes?.fields.map((field) => `data.${field.handle}`) ?? []),
    ]);
    const bound = listNodes(list!).flatMap((node) => Object.values(node.bindings ?? {}));
    expect(bound).toEqual(expect.arrayContaining(["title", "data.picture", "data.guest"]));
    for (const path of bound) expect(own.has(path), path).toBe(true);
  });

  it("puts the latest episode and every place to listen on the home page", () => {
    const home = pageNodes("home");
    const texts = home.map((node) => String(node.props.text ?? node.props.label ?? ""));
    expect(texts).toContain("Second Hands");
    expect(texts).toContain("The clockmaker who won’t use a screwdriver");
    for (const place of ["Apple Podcasts ↗", "Spotify ↗", "Pocket Casts ↗", "RSS feed ↗"]) {
      expect(texts, place).toContain(place);
    }
    const cover = home.find((node) => node.name === "Episode cover");
    expect(cover?.effects).toEqual([{ effect: "cursor-word", params: { text: "Listen" } }]);
  });
});
