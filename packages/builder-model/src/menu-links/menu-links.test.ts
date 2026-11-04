import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import { createEmptyPage, type PageNode } from "../document/page-document.schema.js";
import { navigationLogoLeft } from "../sections/site-navigation.js";
import { assignClassNames } from "../styles/class-names.js";
import { compileStylesheet } from "../styles/compile-stylesheet.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import {
  drawerMenuLinks,
  impliedMenuLinkEffect,
  menuItemKey,
  menuLinkOf,
  readMenuLinkSettings,
  withMenuLinks,
} from "./menu-links.js";

function pageWith(children: PageNode[]): PageNode {
  return { ...createEmptyPage().root, children };
}

/** A page with one Menu, its Menu link given these props and styles. */
function menuPage(props: Record<string, unknown> = {}, styles: PageNode["styles"] = { base: {} }) {
  const menu = createNode({ type: "navigation" }, standardCatalogue, createCountingNodeIds("m"));
  const link = menu.children[0]!;
  link.props = { ...link.props, ...props };
  link.styles = styles;
  return pageWith([menu]);
}

const css = (root: PageNode) => compileStylesheet(root, assignClassNames(root, standardCatalogue));

describe("a Menu's Menu link", () => {
  it("comes with every new Menu, and the navigation sections' menus", () => {
    const menu = createNode({ type: "navigation" }, standardCatalogue, createCountingNodeIds("m"));
    expect(menu.children.map((child) => child.type)).toEqual(["menuLink"]);
    expect(standardCatalogue.canContain("navigation", "menuLink")).toBe(true);
    expect(standardCatalogue.canContain("navigation", "heading")).toBe(false);
    expect(standardCatalogue.canContain("container", "menuLink")).toBe(false);
    const section = createNode(navigationLogoLeft(), standardCatalogue, createCountingNodeIds("s"));
    const found: PageNode[] = [];
    const visit = (node: PageNode) => {
      if (node.type === "navigation") found.push(node);
      node.children.forEach(visit);
    };
    visit(section);
    expect(found).toHaveLength(1);
    expect(menuLinkOf(found[0]!)?.type).toBe("menuLink");
  });

  it("is added to menus made before it, and leaves a page without menus as it was", () => {
    const old = { ...menuPage().children[0]!, children: [] };
    const root = pageWith([old]);
    const ids = createCountingNodeIds("n");
    const upgraded = withMenuLinks(root, ids);
    expect(upgraded.children[0]!.children.map((child) => child.type)).toEqual(["menuLink"]);
    expect(withMenuLinks(upgraded, ids)).toBe(upgraded);
    const plain = pageWith([createNode({ type: "heading" }, standardCatalogue, ids)]);
    expect(withMenuLinks(plain, ids)).toBe(plain);
  });

  it("keys links by their menu item's id, or by their place when they have none", () => {
    expect(menuItemKey("4f1c2b8e-0d1a-4c55-9a3e-1b2c3d4e5f60", 0)).toBe(
      "4f1c2b8e-0d1a-4c55-9a3e-1b2c3d4e5f60",
    );
    expect(menuItemKey(undefined, 2)).toBe("link-3");
    expect(menuItemKey('bad"id', 0)).toBe("link-1");
  });

  it("reads stored settings carefully", () => {
    expect(
      readMenuLinkSettings({
        hoverLook: "sparkles",
        lookColour: "red; } body { display: none",
        itemStyles: { 'x"]': { base: {} }, ok: { base: { color: "red" } } },
      }),
    ).toEqual({
      hoverLook: "none",
      colour: "",
      keepOnCurrent: true,
      itemStyles: { ok: { base: { color: "red" } } },
    });
  });
});

describe("a menu's look in the CSS", () => {
  it("draws old menus, and new ones with nothing changed, as before", () => {
    const old = { ...menuPage().children[0]!, children: [] };
    expect(css(pageWith([old]))).toBe("");
    expect(css(menuPage())).toBe("");
  });

  it("styles every link with the shared look, its Hovered look and its Current look", () => {
    const output = css(
      menuPage(
        {},
        {
          base: { color: "var(--lintel-color-text)", paddingTop: "4px" },
          hover: { color: "var(--lintel-color-brand)" },
          selected: { borderColor: "currentColor", borderRadius: "999px" },
        },
      ),
    );
    expect(output).toMatch(/\.menu-link \{\n[^}]*color: var\(--lintel-color-text\);/);
    expect(output).toContain(
      ".menu-link:hover {\n  color: var(--lintel-color-brand-text, var(--lintel-color-brand));\n}",
    );
    expect(output).toContain(
      '.menu-link:is([aria-current="page"], [aria-selected="true"], [aria-pressed="true"]) {',
    );
  });

  it("lets one link change on its own, keeping the shared look and states over it", () => {
    const output = css(
      menuPage(
        {
          itemStyles: {
            contact: {
              base: { backgroundColor: "var(--lintel-color-brand)", color: "white" },
              hover: { opacity: "0.9" },
              phone: { paddingLeft: "8px" },
            },
          },
        },
        { base: { color: "black" }, hover: { color: "grey" } },
      ),
    );
    const own = output.indexOf('.menu-link[data-menu-item="contact"] {');
    const sharedHover = output.indexOf(".menu-link:hover {");
    expect(own).toBeGreaterThan(output.indexOf(".menu-link {"));
    // The shared Hovered look still shows on Contact, so it comes after Contact's own look.
    expect(sharedHover).toBeGreaterThan(own);
    expect(output).toContain(
      '.menu-link[data-menu-item="contact"] {\n  color: white;\n  background-color: var(--lintel-color-brand);\n}',
    );
    expect(output).toContain('.menu-link[data-menu-item="contact"]:hover {\n  opacity: 0.9;\n}');
    expect(output).toMatch(
      /@media \(max-width: \d+px\) \{\n {2}\.menu-link\[data-menu-item="contact"\] \{\n {4}padding-left: 8px;/,
    );
  });

  it("writes each hover look for hover (where devices can), keyboard focus and the current page", () => {
    const underline = css(menuPage({ hoverLook: "underline" }));
    expect(underline).toContain(":where(.menu-link)::after {");
    expect(underline).toContain("background: currentColor;");
    expect(underline).toMatch(/@media \(hover: hover\) \{\n {2}\.menu-link:hover::after \{/);
    expect(underline).toContain(".menu-link:focus-visible::after {");
    expect(underline).toContain('.menu-link[aria-current="page"]::after {');
    expect(underline).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\n {2}:where\(\.menu-link\)::after \{\n {4}transition: none;/,
    );

    const circle = css(menuPage({ hoverLook: "circle", lookColour: "var(--lintel-var-sand)" }));
    expect(circle).toContain("border: 1px solid var(--lintel-var-sand);");
    expect(circle).toContain("border-radius: 50%;");
    expect(circle).toContain('.menu-link[aria-current="page"]::before {\n  opacity: 1;');

    const colour = css(menuPage({ hoverLook: "colour" }));
    expect(colour).toContain(":where(.menu-link) {\n  transition: color 0.3s ease;");
    expect(colour).toContain(
      "@media (hover: hover) {\n  .menu-link:hover {\n    color: var(--lintel-color-brand);",
    );

    const roll = css(menuPage({ hoverLook: "rollUp" }));
    expect(roll).toContain(
      ":where(.menu-link) .lintel-roll__copy {\n  transform: translateY(100%);",
    );
    expect(roll).toMatch(
      /@media \(hover: hover\) and \(prefers-reduced-motion: no-preference\) \{\n {2}\.menu-link:hover \.lintel-roll__words \{\n {4}transform: translateY\(-100%\);/,
    );
    expect(roll).toMatch(
      /@media \(prefers-reduced-motion: no-preference\) \{\n {2}\.menu-link:focus-visible \.lintel-roll__words/,
    );

    // The scramble is a script, so it adds no CSS; it runs as an effect.
    expect(css(menuPage({ hoverLook: "scramble" }))).toBe("");
  });

  it("can leave the current page's link without the look", () => {
    const output = css(menuPage({ hoverLook: "circle", keepOnCurrent: false }));
    expect(output).not.toContain("aria-current");
    expect(output).toContain(".menu-link:focus-visible::before {");
  });

  it("gives the drawer of a Menu button near the menu the same look, underlining its current link", () => {
    const section = createNode(navigationLogoLeft(), standardCatalogue, createCountingNodeIds("s"));
    const root = pageWith([section]);
    const menu = section.children[0]!.children.find((child) => child.type === "navigation")!;
    const drawer = section.children[0]!.children.find((child) => child.type === "mobileMenu")!;
    const link = menuLinkOf(menu)!;
    link.props = { ...link.props, hoverLook: "circle" };
    link.styles = { base: { color: "black" } };
    expect(drawerMenuLinks(root).get(link.id)).toEqual([drawer.id]);
    const output = css(root);
    const drawerLinks = ".menu-button .lintel-drawer__links > li > a";
    expect(output).toContain(`.menu-link,
${drawerLinks} {
  color: black;`);
    // A drawer's links are whole rows: no circle across the drawer, an underline instead.
    expect(output).not.toContain(`${drawerLinks})::before`);
    expect(output).toContain(
      `${drawerLinks}:focus-visible,
${drawerLinks}[aria-current="page"] {
  text-decoration-line: underline;`,
    );
  });
});

describe("the scramble look", () => {
  it("runs the scramble-on-hover effect on the Menu link, and nothing for other looks", () => {
    const link = menuPage({ hoverLook: "scramble" }).children[0]!.children[0]!;
    expect(impliedMenuLinkEffect(link)).toEqual({
      effect: "scramble-on-hover",
      params: { duration: 450 },
    });
    expect(
      impliedMenuLinkEffect(menuPage({ hoverLook: "circle" }).children[0]!.children[0]!),
    ).toBeUndefined();
  });
});
