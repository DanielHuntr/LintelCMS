import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import { ownSiteChrome } from "../components/site-navigation-components.js";
import {
  createEmptyPage,
  type PageDocument,
  type PageNode,
} from "../document/page-document.schema.js";
import { validatePageDocument } from "../document/validate-page.js";
import { findSectionTemplate, sectionTemplates } from "../templates/section-templates.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { assignClassNames } from "../styles/class-names.js";
import {
  asSiteSection,
  hasOwnContent,
  renameNodeId,
  siteSectionNodeIds,
  siteSectionsPage,
  splitSiteSections,
  unmarkedOwnNavigation,
  withSiteSections,
} from "./site-sections.js";

function node(
  id: string,
  type: string,
  props: Record<string, unknown> = {},
  children: PageNode[] = [],
): PageNode {
  return {
    id,
    type,
    name: "",
    props,
    styles: { base: {} },
    children,
    hidden: false,
    locked: false,
  };
}

function page(children: PageNode[], props: Record<string, unknown> = {}): PageDocument {
  const empty = createEmptyPage();
  return { ...empty, root: { ...empty.root, props, children } };
}

const navigation = node("n1", "section", { element: "header" }, [
  node("n2", "navigation", { menuSource: "site" }),
]);
const footer = node("f1", "section", { element: "footer" }, [
  node("f2", "text", { text: "Small print" }),
]);
const body = node("b1", "section", { element: "section" }, [
  node("b2", "heading", { text: "Hello", level: 1 }),
]);

describe("the site's navigation and footer in a page being edited", () => {
  it("puts the navigation first and the footer last, under their own ids", () => {
    const merged = withSiteSections(page([body]), { navigation, footer });
    expect(merged.root.children.map((child) => child.id)).toEqual([
      "site-navigation",
      "b1",
      "site-footer",
    ]);
    expect(merged.root.children.every((child) => !child.hidden)).toBe(true);
  });

  it("takes them out again for saving, so pages never keep a copy", () => {
    const merged = withSiteSections(page([body]), { navigation, footer });
    const { document, sections } = splitSiteSections(merged);
    expect(document.root.children.map((child) => child.id)).toEqual(["b1"]);
    expect(sections.navigation?.id).toBe("site-navigation");
    expect(sections.footer?.children[0]?.props.text).toBe("Small print");
  });

  it("keeps a page's choice to hide one as the page's own setting", () => {
    const merged = withSiteSections(page([body], { hideSiteNavigation: true }), {
      navigation,
      footer,
    });
    expect(merged.root.children[0]?.hidden).toBe(true);
    const shown = {
      ...merged,
      root: {
        ...merged.root,
        children: merged.root.children.map((child) => ({ ...child, hidden: false })),
      },
    };
    const split = splitSiteSections(shown);
    expect(split.document.root.props.hideSiteNavigation).toBeUndefined();
    expect(split.sections.navigation?.hidden).toBe(false);

    const hidden = splitSiteSections(merged);
    expect(hidden.document.root.props.hideSiteNavigation).toBe(true);
  });

  it("hides the site's navigation on a page that has its own, so there are never two", () => {
    const own = node("own", "section", { element: "header" }, [node("m", "navigation")]);
    const merged = withSiteSections(page([own, body]), { navigation, footer: null });
    expect(merged.root.children[0]).toMatchObject({ id: "site-navigation", hidden: true });
    expect(ownSiteChrome(merged.root).header).toBe(true);
  });

  it("doesn't count the site's own sections as the page's", () => {
    const merged = withSiteSections(page([body]), { navigation, footer });
    expect(ownSiteChrome(merged.root)).toEqual({ header: false, footer: false });
    expect(hasOwnContent(merged.root)).toBe(true);
    expect(hasOwnContent(withSiteSections(page([]), { navigation, footer }).root)).toBe(false);
  });

  it("says a section taken off the site is gone", () => {
    expect(splitSiteSections(page([body])).sections).toEqual({ navigation: null, footer: null });
  });
});

describe("making a section the site's", () => {
  it("gives it the fixed id and the landmark element, and keeps what pointed at it", () => {
    const section = {
      ...node("x9", "section", { element: "section" }, [
        {
          ...node("x10", "text"),
          styles: { base: {}, owners: { "hover@x9": { opacity: "0.5" } } },
        },
      ]),
    };
    const shared = asSiteSection(section, "navigation");
    expect(shared.id).toBe(siteSectionNodeIds.navigation);
    expect(shared.props.element).toBe("header");
    expect(shared.children[0]?.styles.owners).toEqual({
      "hover@site-navigation": { opacity: "0.5" },
    });
    expect(renameNodeId(section, "x9", "x9")).toBe(section);
  });
});

describe("drawing them apart from a page", () => {
  it("names every element so its class names start with site-", () => {
    const document = siteSectionsPage({ navigation, footer }, standardCatalogue);
    const classes = [...assignClassNames(document.root, standardCatalogue).entries()]
      .filter(([id]) => id !== "page")
      .map(([, className]) => className);
    expect(classes.every((className) => className.startsWith("site-"))).toBe(true);
  });
});

describe("offering a page's first section as its own navigation", () => {
  it("offers a first section holding a menu, or a row of links", () => {
    const withMenu = node("top", "section", { element: "section" }, [node("m", "navigation")]);
    expect(unmarkedOwnNavigation(page([withMenu, body]).root)?.id).toBe("top");
    const links = node("row", "section", {}, [
      node("box", "box", {}, [node("l1", "link"), node("l2", "link"), node("l3", "link")]),
    ]);
    expect(unmarkedOwnNavigation(page([links]).root)?.id).toBe("row");
  });

  it("doesn't offer a plain first section, or one already marked", () => {
    expect(unmarkedOwnNavigation(page([body]).root)).toBeNull();
    const marked = node("top", "section", { element: "header" }, [node("m", "navigation")]);
    expect(unmarkedOwnNavigation(page([marked]).root)).toBeNull();
  });

  it("looks past the site's own navigation for the page's first section", () => {
    const withMenu = node("top", "section", { element: "section" }, [node("m", "navigation")]);
    const merged = withSiteSections(page([withMenu]), { navigation, footer: null });
    expect(unmarkedOwnNavigation(merged.root)?.id).toBe("top");
  });
});

describe("the Navigation and Footer groups", () => {
  const createId = createCountingNodeIds("t");
  const groups = sectionTemplates.filter(
    (template) => template.category === "navigation" || template.category === "footer",
  );

  it("offers five navigation layouts and eight footers", () => {
    expect(groups.filter((template) => template.category === "navigation")).toHaveLength(5);
    expect(groups.filter((template) => template.category === "footer")).toHaveLength(8);
  });

  it.each(groups.map((template) => [template.id, template] as const))(
    "%s makes a valid page, as a header or footer, with the site's menu",
    (_id, template) => {
      const section = createNode(template.blueprint, standardCatalogue, createId);
      const checked = validatePageDocument(page([section]), standardCatalogue);
      expect(checked.ok).toBe(true);
      expect(section.props.element).toBe(template.category === "navigation" ? "header" : "footer");
      const json = JSON.stringify(section);
      // The oldest footer keeps its own few links; every other one follows the site's menu.
      if (template.id !== "footer-simple") expect(json).toContain('"menuSource":"site"');
    },
  );

  it("folds the menu into a Menu button on small screens", () => {
    const section = createNode(
      findSectionTemplate("navigation-logo-left")!.blueprint,
      standardCatalogue,
      createId,
    );
    const types = JSON.stringify(section);
    expect(types).toContain('"type":"mobileMenu"');
    expect(types).toContain('"phone":{"display":"none"}');
    expect(types).toContain('"phone":{"display":"block"}');
  });
});
