import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { ContentSection } from "./ContentSection.js";
import { testNode } from "./testTree.js";

const home = testNode({ id: "home", title: "Home", childCount: 2, isSiteStart: true });
const about = testNode({ id: "about", title: "About", parentId: "home", status: "published" });
const contact = testNode({
  id: "contact",
  title: "Contact",
  parentId: "home",
  status: "published",
  hasUnpublishedChanges: true,
});

const roots = {
  sites: [{ id: "s1", name: "Default site", locale: "en-GB" }],
  site: { id: "s1", name: "Default site", locale: "en-GB" },
  locale: "en-GB",
  roots: [
    {
      handle: "pages",
      name: "Pages",
      blueprintHandle: "page",
      structure: "tree",
      childCount: 1,
      childrenAsCollection: false,
    },
    {
      handle: "posts",
      name: "Blog posts",
      blueprintHandle: "post",
      structure: "dated",
      childCount: 240,
      childrenAsCollection: true,
    },
  ],
  siteStartCount: 1,
  recycleBinCount: 2,
};

function level(items: unknown[]) {
  return { items, total: items.length, offset: 0, limit: 100 };
}

const homeHostnames = {
  entryId: "home",
  hostname: "",
  pathPrefix: "",
  isAssigned: false,
  isDefault: true,
  url: "/",
};

function answerTree(options: { siteStartCount?: number; addressChanges?: unknown[] } = {}) {
  return mockApi(({ method, url, body }) => {
    const path = url.pathname;
    if (path.endsWith("/content-tree")) {
      return { ...roots, siteStartCount: options.siteStartCount ?? 1 };
    }
    if (path.endsWith("/content-tree/entries/home/hostnames")) {
      return method === "PUT"
        ? { ...homeHostnames, isAssigned: true, url: "/start" }
        : homeHostnames;
    }
    if (method === "POST" && path.endsWith("/seo/redirects/moved")) {
      return { added: (body as { redirects: unknown[] }).redirects.length, kept: 0 };
    }
    if (path.endsWith("/content-tree/children")) {
      return url.searchParams.get("parentId") === "home" ? level([about, contact]) : level([home]);
    }
    if (path.endsWith("/content-tree/allowed-types")) {
      return {
        types: [{ handle: "pages", name: "Pages", blueprintHandle: "page", structure: "tree" }],
      };
    }
    if (method === "POST" && path.endsWith("/content-tree/move")) {
      return {
        previous: { parentId: "home", index: 1 },
        addressChanges: options.addressChanges ?? [],
      };
    }
    if (method === "POST" && path.endsWith("/collections/pages/entries")) {
      return { ...about, id: "new-page", title: "Team", collectionHandle: "pages" };
    }
    throw new Error(`Unexpected ${method} ${path}`);
  });
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

/** Without site-wide permissions, so only the collections are in the tree. */
const editor = { permissions: ["entries:*"], initialPath: "/content" };

describe("the content tree", () => {
  it("shows each collection, and long lists as a folder with a count", async () => {
    answerTree();
    renderScreen(<ContentSection />, editor);

    const tree = await screen.findByRole("tree", { name: "Content tree" });
    expect(within(tree).getByRole("treeitem", { name: "Pages" })).toBeTruthy();
    // The count is said in words after the name (LINTEL-A11Y-004).
    const blog = within(tree).getByRole("treeitem", { name: /^Blog posts, 240 / });
    expect(blog.getAttribute("aria-expanded")).toBeNull();
    expect(screen.getByText("240")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Recycle bin, 2 items" })).toBeTruthy();
  });

  // The tree always took a column beside the page, and the top of every Content screen on a
  // phone; now it folds away and stays folded.
  it("folds away to give the page room, and remembers it", async () => {
    answerTree();
    renderScreen(<ContentSection />, editor);

    await screen.findByRole("tree", { name: "Content tree" });
    await userEvent.click(screen.getByRole("button", { name: "Hide pages" }));
    expect(screen.queryByRole("tree", { name: "Content tree" })).toBeNull();
    cleanup();

    renderScreen(<ContentSection />, editor);
    const show = await screen.findByRole("button", { name: "Show pages" });
    expect(screen.queryByRole("tree", { name: "Content tree" })).toBeNull();
    await userEvent.click(show);
    expect(await screen.findByRole("tree", { name: "Content tree" })).toBeTruthy();
  });

  it("opens branches with the arrow keys and remembers them", async () => {
    answerTree();
    renderScreen(<ContentSection />, editor);

    const pages = await screen.findByRole("treeitem", { name: "Pages" });
    pages.focus();
    await userEvent.keyboard("{ArrowRight}");
    const homeRow = await screen.findByRole("treeitem", { name: "Home, Draft" });
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(homeRow);
    await userEvent.keyboard("{ArrowRight}");

    expect(await screen.findByRole("treeitem", { name: "About, Live" })).toBeTruthy();
    expect(screen.getByRole("treeitem", { name: "Contact, Changes not published" })).toBeTruthy();
    expect(
      JSON.parse(window.localStorage.getItem("lintel.contentTree.expanded.main") ?? "[]"),
    ).toEqual(["root:pages", "home"]);

    await userEvent.keyboard("{ArrowLeft}");
    await waitFor(() => expect(screen.queryByRole("treeitem", { name: "About, Live" })).toBeNull());
  });

  it("creates under a page from its menu, offering only the allowed content types", async () => {
    window.localStorage.setItem("lintel.contentTree.expanded.main", '["root:pages"]');
    const api = answerTree();
    renderScreen(<ContentSection />, editor);

    const homeRow = await screen.findByRole("treeitem", { name: "Home, Draft" });
    fireEvent.contextMenu(homeRow.firstElementChild ?? homeRow);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Create…" }));

    // Only pages may go here, so there's no question about what to make: the title says it.
    const dialog = await screen.findByRole("dialog", { name: "New page in Home" });
    expect(within(dialog).queryAllByRole("radio")).toEqual([]);
    expect(within(dialog).queryByText("What would you like to make?")).toBeNull();
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Name" }), "Team");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(api.calls.find((call) => call.method === "POST")?.body).toMatchObject({
        data: { title: "Team" },
        parentId: "home",
      }),
    );
    const allowed = api.calls.find((call) => call.url.pathname.endsWith("/allowed-types"));
    expect(allowed?.url.searchParams.get("parentId")).toBe("home");
  });

  it("moves a dragged page and offers to undo it", async () => {
    window.localStorage.setItem("lintel.contentTree.expanded.main", '["root:pages","home"]');
    const api = answerTree();
    renderScreen(<ContentSection />, editor);

    const contactRow = await screen.findByRole("treeitem", { name: /^Contact/ });
    const aboutRow = await screen.findByRole("treeitem", { name: "About, Live" });
    const dataTransfer = { setData: () => undefined, effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(contactRow.firstElementChild as Element, { dataTransfer });
    // jsdom rows have no height, so a drop lands in the middle: inside About.
    fireEvent.dragOver(aboutRow.firstElementChild as Element, { dataTransfer, clientY: 0 });
    fireEvent.drop(aboutRow.firstElementChild as Element, { dataTransfer });

    await screen.findByText("Moved “Contact”.");
    const moves = () =>
      api.calls.filter((call) => call.url.pathname.endsWith("/content-tree/move"));
    expect(moves()[0]?.body).toEqual({
      entryId: "contact",
      parentId: "about",
      index: Number.MAX_SAFE_INTEGER,
    });

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(moves()[1]?.body).toEqual({ entryId: "contact", parentId: "home", index: 1 }),
    );
  });

  it("creates a page at the top from the + beside Content, offering what may go there", async () => {
    const api = answerTree();
    renderScreen(<ContentSection />, editor);

    await userEvent.click(await screen.findByRole("button", { name: "Create a page at the top" }));
    const dialog = await screen.findByRole("dialog", { name: "New page" });
    // Focus starts in Name once the content types have loaded (LINTEL-A11Y-031).
    const nameField = await within(dialog).findByRole("textbox", { name: "Name" });
    await waitFor(() => expect(nameField).toHaveFocus());
    await userEvent.type(nameField, "Shop");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(api.calls.find((call) => call.method === "POST")?.body).toMatchObject({
        data: { title: "Shop" },
      }),
    );
    // No parent: it goes at the top of its section.
    const created = api.calls.find((call) => call.method === "POST")?.body as { parentId?: string };
    expect(created.parentId ?? null).toBeNull();
    const allowed = api.calls.find((call) => call.url.pathname.endsWith("/allowed-types"));
    expect([...(allowed?.url.searchParams.keys() ?? [])]).toEqual([]);
  });

  it("offers Create on a right-click in the tree's empty space", async () => {
    answerTree();
    renderScreen(<ContentSection />, editor);

    const tree = await screen.findByRole("tree", { name: "Content tree" });
    fireEvent.contextMenu(tree.parentElement as Element);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Create…" }));
    expect(await screen.findByRole("dialog", { name: "New page" })).toBeTruthy();
  });

  it("asks for the home page while nothing is at the top, with Home as its name", async () => {
    answerTree({ siteStartCount: 0 });
    renderScreen(<ContentSection />, editor);

    await screen.findByRole("heading", { name: "Create your home page" });
    await userEvent.click(screen.getByRole("button", { name: "Create home page" }));
    const dialog = await screen.findByRole("dialog", { name: "Create your home page" });
    expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveProperty("value", "Home");
  });

  it("drops a page on its section to put it at the top", async () => {
    window.localStorage.setItem("lintel.contentTree.expanded.main", '["root:pages","home"]');
    const api = answerTree();
    renderScreen(<ContentSection />, editor);

    const aboutRow = await screen.findByRole("treeitem", { name: "About, Live" });
    const pages = screen.getByRole("treeitem", { name: "Pages" });
    const dataTransfer = { setData: () => undefined, effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(aboutRow.firstElementChild as Element, { dataTransfer });
    fireEvent.dragOver(pages.firstElementChild as Element, { dataTransfer });
    fireEvent.drop(pages.firstElementChild as Element, { dataTransfer });

    await screen.findByText("Moved “About”.");
    const move = api.calls.find((call) => call.url.pathname.endsWith("/content-tree/move"));
    expect(move?.body).toEqual({
      entryId: "about",
      parentId: null,
      index: Number.MAX_SAFE_INTEGER,
    });
  });

  it("offers redirects from the old addresses after a move changes them", async () => {
    window.localStorage.setItem("lintel.contentTree.expanded.main", '["root:pages","home"]');
    const change = { entryId: "about", title: "About", from: "/about", to: "/about-us/about" };
    const api = answerTree({ addressChanges: [change] });
    renderScreen(<ContentSection />, { initialPath: "/content", enabledPlugins: ["seo"] });

    const aboutRow = await screen.findByRole("treeitem", { name: "About, Live" });
    const pages = screen.getByRole("treeitem", { name: "Pages" });
    const dataTransfer = { setData: () => undefined, effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(aboutRow.firstElementChild as Element, { dataTransfer });
    fireEvent.dragOver(pages.firstElementChild as Element, { dataTransfer });
    fireEvent.drop(pages.firstElementChild as Element, { dataTransfer });

    await screen.findByText("Moved “About”. One page address changed.");
    await userEvent.click(screen.getByRole("button", { name: "Add redirects…" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Add redirects from the old addresses?",
    });
    expect(within(dialog).getByText("/about-us/about")).toBeTruthy();
    await userEvent.click(within(dialog).getByRole("button", { name: "Add redirects" }));

    await screen.findByText("Added a redirect.");
    const added = api.calls.find((call) => call.url.pathname.endsWith("/seo/redirects/moved"));
    expect(added?.body).toEqual({
      redirects: [{ entryId: "about", fromPath: "/about", toPath: "/about-us/about" }],
    });
  });

  it("doesn't offer redirects without the SEO tools", async () => {
    window.localStorage.setItem("lintel.contentTree.expanded.main", '["root:pages","home"]');
    const change = { entryId: "about", title: "About", from: "/about", to: "/about-us/about" };
    answerTree({ addressChanges: [change] });
    renderScreen(<ContentSection />, { initialPath: "/content", enabledPlugins: [] });

    const aboutRow = await screen.findByRole("treeitem", { name: "About, Live" });
    const pages = screen.getByRole("treeitem", { name: "Pages" });
    const dataTransfer = { setData: () => undefined, effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(aboutRow.firstElementChild as Element, { dataTransfer });
    fireEvent.dragOver(pages.firstElementChild as Element, { dataTransfer });
    fireEvent.drop(pages.firstElementChild as Element, { dataTransfer });

    await screen.findByText("Moved “About”. One page address changed.");
    expect(screen.queryByRole("button", { name: "Add redirects…" })).toBeNull();
  });

  it("gives a page at the top a path of its own from Hostnames", async () => {
    window.localStorage.setItem("lintel.contentTree.expanded.main", '["root:pages"]');
    const api = answerTree();
    renderScreen(<ContentSection />, { initialPath: "/content" });

    const homeRow = await screen.findByRole("treeitem", { name: "Home, Draft" });
    fireEvent.contextMenu(homeRow.firstElementChild ?? homeRow);
    await userEvent.click(await screen.findByRole("menuitem", { name: "More" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Hostnames…" }));

    const dialog = await screen.findByRole("dialog", { name: "Hostnames for “Home”" });
    await within(dialog).findByText(
      "This is your home page, because it’s the first page at the top.",
    );
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Path" }), "/start");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await screen.findByText("Saved. “Home” is now at /start.");
    const saved = api.calls.find((call) => call.method === "PUT");
    expect(saved?.body).toEqual({ hostname: "", pathPrefix: "/start" });
  });

  it("keeps Hostnames from people who can't change settings", async () => {
    window.localStorage.setItem("lintel.contentTree.expanded.main", '["root:pages"]');
    answerTree();
    renderScreen(<ContentSection />, editor);

    const homeRow = await screen.findByRole("treeitem", { name: "Home, Draft" });
    fireEvent.contextMenu(homeRow.firstElementChild ?? homeRow);
    await screen.findByRole("menuitem", { name: "Create…" });
    expect(screen.queryByRole("menuitem", { name: "Hostnames…" })).toBeNull();
  });
});

describe("the content tree (QA sweep)", () => {
  function answerWithEdits() {
    return mockApi(({ method, url, body }) => {
      const path = url.pathname;
      if (path.endsWith("/content-tree")) return roots;
      if (path.endsWith("/content-tree/children")) {
        return url.searchParams.get("parentId") === "home"
          ? level([about, contact])
          : level([home]);
      }
      if (method === "PATCH" && path.endsWith("/entries/about")) {
        return { ...about, data: (body as { data: unknown }).data };
      }
      throw new Error(`Unexpected ${method} ${path}`);
    });
  }

  it("unfolds Pages and the home page when Pages is chosen", async () => {
    answerWithEdits();
    renderScreen(<ContentSection />, { ...editor, initialPath: "/content/pages" });

    expect(await screen.findByRole("treeitem", { name: "Home, Draft" })).toBeTruthy();
    expect(await screen.findByRole("treeitem", { name: "About, Live" })).toBeTruthy();
  });

  it("lists the tree's pages in Move… before anything is typed", async () => {
    window.localStorage.setItem("lintel.contentTree.expanded.main", '["root:pages","home"]');
    answerWithEdits();
    renderScreen(<ContentSection />, editor);

    const aboutRow = await screen.findByRole("treeitem", { name: "About, Live" });
    fireEvent.contextMenu(aboutRow.firstElementChild ?? aboutRow);
    await userEvent.click(await screen.findByRole("menuitem", { name: "More" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Move…" }));
    const dialog = await screen.findByRole("dialog", { name: "Move “About”" });
    await within(dialog).findByRole("radio", { name: /^Home/ });
    expect(within(dialog).getByRole("radio", { name: /^Contact/ })).toBeTruthy();
    // What is moving is never offered as its own new place.
    expect(within(dialog).queryByRole("radio", { name: /^About/ })).toBeNull();
  });

  it("renames a page from its right-click menu", async () => {
    window.localStorage.setItem("lintel.contentTree.expanded.main", '["root:pages","home"]');
    const api = answerWithEdits();
    renderScreen(<ContentSection />, editor);

    const aboutRow = await screen.findByRole("treeitem", { name: "About, Live" });
    fireEvent.contextMenu(aboutRow.firstElementChild ?? aboutRow);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Rename…" }));
    const dialog = await screen.findByRole("dialog", { name: "Rename “About”" });
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    await userEvent.clear(name);
    await userEvent.type(name, "About us");
    await userEvent.click(within(dialog).getByRole("button", { name: "Rename" }));

    await waitFor(() =>
      expect(api.calls.find((call) => call.method === "PATCH")?.body).toEqual({
        data: { title: "About us" },
      }),
    );
    expect(await screen.findByText("Renamed to “About us”.")).toBeTruthy();
  });
});
