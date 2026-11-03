import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import type { NodeBlueprint } from "../components/component-definition.js";
import { validatePageDocument } from "../document/validate-page.js";
import { findIllustration } from "../starter-sites/illustrations.js";
import { buildStarterPage } from "../starter-sites/starter-site.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { sectionPacks } from "./section-packs.js";
import { sectionCategories, sectionTemplates } from "./section-templates.js";

function everyNode(blueprint: NodeBlueprint): NodeBlueprint[] {
  return [blueprint, ...(blueprint.children ?? []).flatMap(everyNode)];
}

const byId = (id: string) => sectionPacks.find((template) => template.id === id);

describe("the section packs", () => {
  it("adds at least twenty sections, each with its own id in the library", () => {
    expect(sectionPacks.length).toBeGreaterThanOrEqual(20);
    const ids = sectionTemplates.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const pack of sectionPacks) {
      expect(
        ids.filter((id) => id === pack.id),
        pack.id,
      ).toHaveLength(1);
    }
  });

  it("gives every section a plain description, a known group and search words", () => {
    for (const pack of sectionPacks) {
      expect(pack.description.length, pack.id).toBeGreaterThan(20);
      expect(pack.description.endsWith("."), pack.id).toBe(true);
      expect(sectionCategories, pack.id).toContain(pack.category);
      expect(pack.keywords?.length ?? 0, pack.id).toBeGreaterThanOrEqual(4);
    }
  });

  it("covers intros, features, proof, prices, questions, team, pictures, contact and footers", () => {
    const counts = new Map<string, number>();
    for (const pack of sectionPacks)
      counts.set(pack.category, (counts.get(pack.category) ?? 0) + 1);
    for (const category of [
      "intro",
      "features",
      "about",
      "pictures",
      "proof",
      "pricing",
      "questions",
      "contact",
      "footer",
    ]) {
      expect(counts.get(category) ?? 0, category).toBeGreaterThanOrEqual(2);
    }
    const types = (id: string) => everyNode(byId(id)!.blueprint).map((node) => node.type);
    expect(types("intro-video")).toContain("video");
    expect(types("logos-scrolling")).toContain("marquee");
    expect(types("stats-counting")).toContain("counterRow");
    expect(types("questions-open")).toContain("accordion");
    expect(types("newsletter-strip")).toContain("newsletterSignup");
    expect(types("contact-map")).toContain("map");
    expect(types("contact-beside-form")).toContain("formEmbed");
    expect(types("pricing-comparison")).toContain("table");
    const drag = everyNode(byId("drag-gallery")!.blueprint).find(
      (node) => node.type === "carousel",
    );
    expect(drag?.props).toMatchObject({ freeDrag: true });
    expect(drag?.effects?.[0]?.effect).toBe("cursor-word");
  });

  it("builds every section into a design the server accepts", () => {
    for (const pack of sectionPacks) {
      const design = buildStarterPage(
        { slug: "x", title: "x", summary: "", sections: [pack.blueprint] },
        standardCatalogue,
        createCountingNodeIds(),
        { enabledPlugins: ["commerce", "forms"] },
      );
      expect(design.root.children, pack.id).toHaveLength(1);
      const checked = validatePageDocument(design, standardCatalogue);
      expect(checked.ok, `${pack.id}: ${JSON.stringify(checked)}`.slice(0, 600)).toBe(true);
    }
  });

  it("animates something in each, and only uses pictures that exist", () => {
    for (const pack of sectionPacks) {
      const nodes = everyNode(pack.blueprint);
      if (pack.category !== "footer") {
        expect(
          nodes.some((node) => node.animation || node.effects?.length || node.type === "marquee"),
          pack.id,
        ).toBe(true);
      }
      for (const node of nodes.filter((candidate) => candidate.type === "image")) {
        const name = /^\/_lintel\/illustrations\/([a-z-]+)\.svg$/.exec(String(node.props?.src));
        expect(findIllustration(name?.[1] ?? ""), pack.id).toBeDefined();
      }
    }
  });

  it("stacks every multi-column layout on phones", () => {
    for (const pack of sectionPacks) {
      for (const node of everyNode(pack.blueprint)) {
        const columns = node.styles?.base.gridTemplateColumns;
        if (!columns || columns.includes("auto-fit")) continue;
        expect(node.styles?.phone?.gridTemplateColumns, `${pack.id}/${node.name}`).toBeDefined();
      }
    }
  });

  it("keeps one main heading in each intro and none elsewhere", () => {
    for (const pack of sectionPacks) {
      const mainHeadings = everyNode(pack.blueprint).filter(
        (node) => node.type === "heading" && node.props?.level === 1,
      );
      const isWelcome = pack.id.startsWith("intro-");
      expect(mainHeadings, pack.id).toHaveLength(isWelcome ? 1 : 0);
    }
  });

  it("makes footers a footer whose links follow the site's menu", () => {
    for (const pack of sectionPacks.filter((template) => template.category === "footer")) {
      expect(pack.blueprint.props?.element, pack.id).toBe("footer");
      const nodes = everyNode(pack.blueprint);
      const menus = nodes.filter((node) => node.type === "navigation");
      for (const menu of menus) expect(menu.props?.menuSource, pack.id).toBe("site");
      expect(
        menus.length + nodes.filter((node) => node.type === "siteLogo").length,
        pack.id,
      ).toBeGreaterThan(0);
    }
  });
});
