import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  findNode,
  findSectionTemplate,
  type PageDocument,
  type PageNode,
  standardCatalogue,
} from "@lintel/builder-model";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { removeSelected, duplicateSelected, moveSelected } from "../editor/commands.js";
import { PageBuilder } from "../PageBuilder.js";
import { createMemoryPreferenceStore } from "../preferences/builder-preferences.js";
import { renderPage } from "../render/render-page.js";
import { standardRegistry } from "../render/stand-in-components.js";

function pageOf(...children: PageNode[]): PageDocument {
  const page = createEmptyPage();
  return { ...page, root: { ...page.root, children } };
}

/** A page with one Menu (and its Menu link, given these props). */
function menuPage(linkProps: Record<string, unknown> = {}): PageDocument {
  const menu = createNode({ type: "navigation" }, standardCatalogue, createCountingNodeIds("m"));
  const link = menu.children[0]!;
  link.props = { ...link.props, ...linkProps };
  return pageOf(menu);
}

const site = {
  siteName: "Studio",
  homeUrl: "/",
  logo: null,
  menu: [
    { id: "shop", label: "Shop", url: "/shop", current: false, children: [] },
    { id: "home", label: "Home", url: "/", current: true, children: [] },
    { id: "contact", label: "Contact", url: "/contact", current: false, children: [] },
  ],
  socialLinks: [],
  footerText: "",
  languages: [],
  locale: "en-GB",
  apiBase: "/_lintel/api",
};

describe("a menu's links", () => {
  it("draws menus made before Menu links exactly as before", () => {
    const old = { ...menuPage().root.children[0]!, children: [] };
    const { html, css } = renderPage(pageOf(old), standardRegistry, { data: { site } });
    expect(html).toBe(
      '<div class="page"><nav class="menu" aria-label="Main"><ul>' +
        '<li><a href="/shop">Shop</a></li>' +
        '<li><a href="/" aria-current="page">Home</a></li>' +
        '<li><a href="/contact">Contact</a></li>' +
        "</ul></nav></div>",
    );
    expect(css).toBe("");
  });

  it("draws each link with the Menu link's class and its menu item's id", () => {
    const { html, css } = renderPage(menuPage(), standardRegistry, { data: { site } });
    expect(html).toContain(
      '<li><a class="menu-link" href="/" aria-current="page" data-menu-item="home">Home</a></li>',
    );
    expect(html).toContain('data-menu-item="contact">Contact</a>');
    // Nothing changed yet: no CSS, so the links look as they did.
    expect(css).toBe("");
  });

  it("rolls up with a copy of the words that screen readers skip", () => {
    const { html, css } = renderPage(menuPage({ hoverLook: "rollUp" }), standardRegistry, {
      data: { site },
    });
    expect(html).toContain(
      '<span class="lintel-roll"><span class="lintel-roll__words">Shop</span><span class="lintel-roll__copy" aria-hidden="true">Shop</span></span>',
    );
    expect(css).toContain(".menu-link:hover .lintel-roll__words");
  });

  it("scrambles with the effects runtime, and only then ships it", () => {
    const scrambles = renderPage(menuPage({ hoverLook: "scramble" }), standardRegistry, {
      data: { site },
      withMotion: true,
    });
    const linkId = menuPage().root.children[0]!.children[0]!.id;
    expect(scrambles.effects).toEqual([
      {
        nodeId: linkId,
        module: "text",
        behaviour: "scramble",
        params: { trigger: "hover", duration: 450 },
      },
    ]);
    // Every link carries the Menu link's id, so the effect runs on each.
    expect(scrambles.html.match(new RegExp(`data-node-id="${linkId}"`, "g"))).toHaveLength(3);
    const circles = renderPage(menuPage({ hoverLook: "circle" }), standardRegistry, {
      data: { site },
      withMotion: true,
    });
    expect(circles.effects).toEqual([]);
    expect(circles.html).not.toContain("data-node-id");
  });

  it("marks the drawer's links too, and gives them the same look", () => {
    const section = createNode(
      findSectionTemplate("navigation-logo-left")!.blueprint,
      standardCatalogue,
      createCountingNodeIds("s"),
    );
    const page = pageOf(section);
    const menu = section.children[0]!.children.find((child) => child.type === "navigation")!;
    menu.children[0]!.props = { ...menu.children[0]!.props, hoverLook: "underline" };
    const { html, css } = renderPage(page, standardRegistry, { data: { site } });
    expect(html).toMatch(/<dialog[^]*<a href="\/contact" data-menu-item="contact">Contact<\/a>/);
    expect(css).toContain(".menu-button .lintel-drawer__links > li > a:focus-visible,");
  });

  it("keeps the Menu link with its menu: it isn't deleted, copied or moved on its own", () => {
    const document = menuPage();
    const linkId = document.root.children[0]!.children[0]!.id;
    const context = {
      document,
      selectedId: linkId,
      catalogue: standardCatalogue,
      createId: createCountingNodeIds("x"),
      text: (key: string) => key,
    } as Parameters<typeof removeSelected>[0];
    for (const result of [
      removeSelected(context),
      duplicateSelected(context),
      moveSelected(context, "out"),
    ]) {
      expect(result).toEqual({ refused: "pageBuilder.menu.partOfMenu" });
    }
  });
});

describe("styling one link on its own", () => {
  function renderBuilder(document: PageDocument) {
    const onChange = vi.fn<(document: PageDocument) => void>();
    render(
      <PageBuilder
        initialDocument={document}
        onChange={onChange}
        title="Home"
        canEditCode={false}
        createId={createCountingNodeIds("new")}
        preferences={createMemoryPreferenceStore({ tourSeen: "yes" })}
      />,
    );
    return { latest: () => onChange.mock.lastCall?.[0] as PageDocument };
  }

  /** What the canvas frame says when a menu link is clicked. */
  function clickLinkOnCanvas(nodeId: string, menuItem: { id: string; label: string } | null) {
    const frame = window.document.querySelector("iframe")!;
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "select", nodeId, ...(menuItem ? { menuItem } : {}) },
          source: frame.contentWindow,
        }),
      );
    });
  }

  it("gives an older menu its Menu link in Layers without changing the page", () => {
    const old = { ...menuPage().root.children[0]!, children: [] };
    const { latest } = renderBuilder(pageOf(old));
    expect(latest()).toBeUndefined();
    expect(screen.getAllByText("Menu link").length).toBeGreaterThan(0);
  });

  it("asks where changes go, and keeps a change for only Contact by its menu item's id", async () => {
    const user = userEvent.setup();
    const document = menuPage();
    const linkId = document.root.children[0]!.children[0]!.id;
    const { latest } = renderBuilder(document);
    clickLinkOnCanvas(linkId, { id: "contact", label: "Contact" });
    await user.click(screen.getByRole("tab", { name: "Style" }));
    const scope = screen.getByRole("radiogroup", { name: "Changes apply to" });
    expect(within(scope).getByRole("radio", { name: "Every menu link" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.click(within(scope).getByRole("radio", { name: "Only “Contact”" }));
    await user.click(screen.getAllByRole("button", { name: "Brand" })[0]!);
    const link = findNode(latest().root, linkId)!;
    expect(link.styles.base).toEqual({});
    expect(Object.keys(link.props.itemStyles as object)).toEqual(["contact"]);
    expect(screen.getByText("“Contact” has a look of its own.")).toBeInTheDocument();

    // Back to every link: the change goes to the shared look.
    await user.click(within(scope).getByRole("radio", { name: "Every menu link" }));
    await user.click(screen.getAllByRole("button", { name: "Brand" })[0]!);
    expect(Object.keys(findNode(latest().root, linkId)!.styles.base).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Use the shared look" }));
    expect(findNode(latest().root, linkId)!.props.itemStyles).toEqual({});
  });

  it("explains the Menu link when it's chosen without one of its links", async () => {
    const user = userEvent.setup();
    const document = menuPage();
    const linkId = document.root.children[0]!.children[0]!.id;
    renderBuilder(document);
    clickLinkOnCanvas(linkId, { id: "contact", label: "Contact" });
    clickLinkOnCanvas(linkId, null);
    await user.click(screen.getByRole("tab", { name: "Style" }));
    expect(
      screen.getByText(
        "The look of every link in this menu. Click a link on the page to change only that one.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Changes apply to" })).not.toBeInTheDocument();
  });
});
