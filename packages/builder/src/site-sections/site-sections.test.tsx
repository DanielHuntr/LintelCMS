import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  findNode,
  findSectionTemplate,
  type PageDocument,
  type PageNode,
  type SiteSections,
  type SiteSectionsChange,
  standardCatalogue,
} from "@lintel/builder-model";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as commands from "../editor/commands.js";
import { createEditorState, editorReducer, type EditorState } from "../editor/editor-state.js";
import * as siteSectionCommands from "../editor/site-section-commands.js";
import { englishText } from "../i18n/builder-text.js";
import { PageBuilder } from "../PageBuilder.js";
import { createMemoryPreferenceStore } from "../preferences/builder-preferences.js";
import { simpleHero } from "../testing/simple-hero.js";

const createId = createCountingNodeIds("s");

function section(blueprintId: string): PageNode {
  return createNode(findSectionTemplate(blueprintId)!.blueprint, standardCatalogue, createId);
}

function heroPage(): PageDocument {
  const page = createEmptyPage();
  const hero = createNode(simpleHero, standardCatalogue, createCountingNodeIds());
  return { ...page, root: { ...page.root, children: [hero] } };
}

const context = (document: PageDocument, selectedId: string | null = null) => ({
  document,
  selectedId,
  catalogue: standardCatalogue,
  createId: createCountingNodeIds("new"),
  text: englishText,
});

function apply(state: EditorState, result: commands.CommandResult): EditorState {
  if ("refused" in result) throw new Error(result.refused);
  return editorReducer(state, { type: "change", change: result.change, at: 0 });
}

const ids = (document: PageDocument) => document.root.children.map((child) => child.id);

describe("the commands for the site's navigation and footer", () => {
  it("adds a navigation at the top as the site's, and undo takes it away", () => {
    let state = createEditorState(heroPage());
    const blueprint = findSectionTemplate("navigation-logo-left")!.blueprint;
    state = apply(
      state,
      siteSectionCommands.insertSiteSection(context(state.document), "navigation", blueprint),
    );
    expect(ids(state.document)).toEqual(["site-navigation", "n1"]);
    expect(state.past.at(-1)?.label).toBe("Added the navigation to every page");
    state = editorReducer(state, { type: "undo" });
    expect(ids(state.document)).toEqual(["n1"]);
  });

  it("replaces the site's navigation when another is added", () => {
    let state = createEditorState(heroPage());
    const add = (id: string) =>
      siteSectionCommands.insertSiteSection(
        context(state.document),
        "navigation",
        findSectionTemplate(id)!.blueprint,
      );
    state = apply(state, add("navigation-logo-left"));
    state = apply(state, add("navigation-minimal"));
    expect(ids(state.document)).toEqual(["site-navigation", "n1"]);
    expect(state.past.at(-1)?.label).toBe("Changed the navigation on every page");
  });

  it("hides rather than deletes the site's navigation on this page", () => {
    let state = createEditorState(heroPage());
    state = apply(
      state,
      siteSectionCommands.insertSiteSection(
        context(state.document),
        "navigation",
        findSectionTemplate("navigation-logo-left")!.blueprint,
      ),
    );
    state = apply(state, commands.removeSelected(context(state.document, "site-navigation")));
    expect(findNode(state.document.root, "site-navigation")?.hidden).toBe(true);
    expect(state.document.root.props.hideSiteNavigation).toBe(true);
    state = apply(
      state,
      siteSectionCommands.setSiteSectionHidden(context(state.document), "navigation", false),
    );
    expect(findNode(state.document.root, "site-navigation")?.hidden).toBe(false);
    expect(state.document.root.props.hideSiteNavigation).toBeUndefined();
  });

  it("makes a page's section the site's footer, at the bottom", () => {
    let state = createEditorState(heroPage());
    state = apply(
      state,
      siteSectionCommands.useAsSiteSection(context(state.document), "n1", "footer"),
    );
    expect(ids(state.document)).toEqual(["site-footer"]);
    expect(state.document.root.children[0]?.props.element).toBe("footer");
  });

  it("marks a section as the page's own navigation and hides the site's here", () => {
    const page = heroPage();
    let state = createEditorState({
      ...page,
      root: {
        ...page.root,
        children: [
          { ...section("navigation-logo-left"), id: "site-navigation" },
          ...page.root.children,
        ],
      },
    });
    state = apply(
      state,
      siteSectionCommands.markAsPageOwn(context(state.document), "n1", "navigation"),
    );
    expect(findNode(state.document.root, "n1")?.props.element).toBe("header");
    expect(findNode(state.document.root, "site-navigation")?.hidden).toBe(true);
    expect(state.document.root.props.hideSiteNavigation).toBe(true);
  });

  it("keeps the site's sections around a template page used on an empty page", () => {
    const page = createEmptyPage();
    const document = {
      ...page,
      root: {
        ...page.root,
        children: [
          { ...section("navigation-logo-left"), id: "site-navigation" },
          { ...section("footer-centred"), id: "site-footer" },
        ],
      },
    };
    const state = apply(
      createEditorState(document),
      commands.replacePageContent(context(document), heroPage(), "Used a page"),
    );
    expect(ids(state.document)).toEqual(["site-navigation", "n1", "site-footer"]);
  });

  it("removes the site's navigation from every page, and undo brings it back", () => {
    let state = createEditorState(heroPage());
    state = apply(
      state,
      siteSectionCommands.insertSiteSection(
        context(state.document),
        "navigation",
        findSectionTemplate("navigation-logo-left")!.blueprint,
      ),
    );
    state = apply(
      state,
      siteSectionCommands.setSiteSectionHidden(context(state.document), "navigation", true),
    );
    state = apply(
      state,
      siteSectionCommands.removeSiteSectionFromSite(context(state.document), "navigation"),
    );
    expect(ids(state.document)).toEqual(["n1"]);
    expect(state.document.root.props.hideSiteNavigation).toBeUndefined();
    expect(state.past.at(-1)?.label).toBe("Removed the navigation from every page");
    state = editorReducer(state, { type: "undo" });
    expect(ids(state.document)).toEqual(["site-navigation", "n1"]);
  });
});

function renderBuilder(
  document: PageDocument,
  sections: SiteSections,
  preferences: Record<string, string> = {},
) {
  const onChange = vi.fn<(document: PageDocument) => void>();
  const onSectionsChange = vi.fn<(change: SiteSectionsChange) => void>();
  render(
    <PageBuilder
      initialDocument={document}
      onChange={onChange}
      title="Home"
      canEditCode={false}
      createId={createCountingNodeIds("new")}
      preferences={createMemoryPreferenceStore({ tourSeen: "yes", ...preferences })}
      siteSections={{ value: sections, onChange: onSectionsChange }}
    />,
  );
  return { onChange, onSectionsChange };
}

describe("the site's navigation in the builder", () => {
  it("adds a Navigation from Insert to every page, saving it for the site, not the page", async () => {
    const user = userEvent.setup();
    const { onChange, onSectionsChange } = renderBuilder(heroPage(), {
      navigation: null,
      footer: null,
    });
    await user.click(screen.getByRole("tab", { name: "Insert" }));
    await user.click(screen.getByRole("button", { name: /^Navigation/ }));
    await user.click(screen.getByRole("button", { name: /^Logo and menu/ }));
    const saved = onChange.mock.lastCall?.[0] as PageDocument;
    expect(ids(saved)).toEqual(["n1"]);
    const change = onSectionsChange.mock.lastCall?.[0];
    expect(change?.navigation?.id).toBe("site-navigation");
    expect(change).not.toHaveProperty("footer");
    // A site that had the automatic header is told it has gone.
    expect(
      screen.getByText(
        /takes the place of your site’s automatic header on every page when you publish/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Navigation · on every page")).toBeInTheDocument();
  });

  it("hides the site's navigation on this page from the strip, keeping it for the site", async () => {
    const user = userEvent.setup();
    const navigation = { ...section("navigation-logo-left"), id: "site-navigation" };
    const { onChange, onSectionsChange } = renderBuilder(heroPage(), {
      navigation,
      footer: null,
    });
    await user.click(screen.getAllByRole("treeitem", { name: /Navigation/ })[0]!);
    await user.click(screen.getByRole("button", { name: "Hide on this page" }));
    const saved = onChange.mock.lastCall?.[0] as PageDocument;
    expect(saved.root.props.hideSiteNavigation).toBe(true);
    expect(ids(saved)).toEqual(["n1"]);
    expect(onSectionsChange).not.toHaveBeenCalled();
    expect(
      screen.queryByText(
        /takes the place of your site’s automatic header on every page when you publish/,
      ),
    ).not.toBeInTheDocument();
  });

  it("shows the page's switches with nothing selected", async () => {
    const user = userEvent.setup();
    const navigation = { ...section("navigation-logo-left"), id: "site-navigation" };
    const { onChange } = renderBuilder(heroPage(), { navigation, footer: null });
    await user.click(screen.getByRole("tab", { name: "Content" }));
    const settings = screen.getByRole("region", { name: "On this page" });
    await user.click(within(settings).getByRole("switch", { name: "Show the site’s navigation" }));
    expect((onChange.mock.lastCall?.[0] as PageDocument).root.props.hideSiteNavigation).toBe(true);
  });

  it("offers a page's own menu row as its navigation", async () => {
    const user = userEvent.setup();
    const page = heroPage();
    const ownMenu = section("navigation-logo-left");
    const document = {
      ...page,
      root: {
        ...page.root,
        children: [
          { ...ownMenu, props: { ...ownMenu.props, element: "section" } },
          ...page.root.children,
        ],
      },
    };
    const navigation = { ...section("navigation-minimal"), id: "site-navigation" };
    const { onChange } = renderBuilder(document, { navigation, footer: null });
    expect(screen.getByText(/starts with its own menu/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Use as this page’s navigation" }));
    const saved = onChange.mock.lastCall?.[0] as PageDocument;
    expect(saved.root.children[0]?.props.element).toBe("header");
    expect(saved.root.props.hideSiteNavigation).toBe(true);
    expect(screen.queryByText(/starts with its own menu/)).not.toBeInTheDocument();
  });
});

describe("adding and removing the site's navigation (QA sweep)", () => {
  it("undoes a new navigation from the note, taking it off the site", async () => {
    const user = userEvent.setup();
    const { onSectionsChange } = renderBuilder(heroPage(), { navigation: null, footer: null });
    await user.click(screen.getByRole("tab", { name: "Insert" }));
    await user.click(screen.getByRole("button", { name: /^Navigation/ }));
    await user.click(screen.getByRole("button", { name: /^Logo and menu/ }));
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(onSectionsChange.mock.lastCall?.[0]).toEqual({ navigation: null });
    expect(screen.queryByText(/now live on every page/)).not.toBeInTheDocument();
  });

  it("shows a navigation added to an empty page, with the start card below it", async () => {
    const user = userEvent.setup();
    renderBuilder(createEmptyPage(), { navigation: null, footer: null });
    expect(document.querySelector("iframe")).toBeNull();
    await user.click(screen.getByRole("tab", { name: "Insert" }));
    await user.click(screen.getByRole("button", { name: /^Navigation/ }));
    await user.click(screen.getByRole("button", { name: /^Logo and menu/ }));
    expect(document.querySelector("iframe")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "This page is empty" })).toBeInTheDocument();
  });

  it("asks where to delete the site's navigation from, and can remove it from every page", async () => {
    const user = userEvent.setup();
    const navigation = { ...section("navigation-logo-left"), id: "site-navigation" };
    const { onChange, onSectionsChange } = renderBuilder(heroPage(), {
      navigation,
      footer: null,
    });
    const item = screen.getAllByRole("treeitem", { name: /Navigation/ })[0]!;
    await user.click(item);
    item.focus();
    await user.keyboard("{Delete}");
    const dialog = screen.getByRole("dialog", { name: "Remove the navigation?" });
    await user.click(within(dialog).getByRole("button", { name: /^Remove from every page/ }));
    expect(onSectionsChange.mock.lastCall?.[0]).toEqual({ navigation: null });
    const saved = onChange.mock.lastCall?.[0] as PageDocument;
    expect(saved.root.props.hideSiteNavigation).toBeUndefined();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("can still just hide it on this page from the same question", async () => {
    const user = userEvent.setup();
    const navigation = { ...section("navigation-logo-left"), id: "site-navigation" };
    const { onChange, onSectionsChange } = renderBuilder(heroPage(), {
      navigation,
      footer: null,
    });
    await user.click(screen.getAllByRole("treeitem", { name: /Navigation/ })[0]!);
    await user.click(screen.getByRole("button", { name: "Remove…" }));
    const dialog = screen.getByRole("dialog", { name: "Remove the navigation?" });
    await user.click(within(dialog).getByRole("button", { name: /^Hide on this page/ }));
    expect((onChange.mock.lastCall?.[0] as PageDocument).root.props.hideSiteNavigation).toBe(true);
    expect(onSectionsChange).not.toHaveBeenCalled();
  });
});
