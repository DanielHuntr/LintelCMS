import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { ContentSection } from "./ContentSection.js";
import { testNode } from "./testTree.js";

const home = testNode({ id: "home", title: "Home", childCount: 2 });
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
  recycleBinCount: 2,
};

function level(items: unknown[]) {
  return { items, total: items.length, offset: 0, limit: 100 };
}

function answerTree() {
  return mockApi(({ method, url }) => {
    const path = url.pathname;
    if (path.endsWith("/content-tree")) return roots;
    if (path.endsWith("/content-tree/children")) {
      return url.searchParams.get("parentId") === "home" ? level([about, contact]) : level([home]);
    }
    if (path.endsWith("/content-tree/allowed-types")) {
      return {
        types: [{ handle: "pages", name: "Pages", blueprintHandle: "page", structure: "tree" }],
      };
    }
    if (method === "POST" && path.endsWith("/content-tree/move")) {
      return { previous: { parentId: "home", index: 1 } };
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
    expect(
      within(tree).getByRole("treeitem", { name: "Blog posts" }).getAttribute("aria-expanded"),
    ).toBeNull();
    expect(screen.getByText("240")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Recycle bin, 2 items" })).toBeTruthy();
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

    expect(await screen.findByRole("treeitem", { name: "About, Published" })).toBeTruthy();
    expect(
      screen.getByRole("treeitem", { name: "Contact, Published, with changes not yet published" }),
    ).toBeTruthy();
    expect(
      JSON.parse(window.localStorage.getItem("lintel.contentTree.expanded.main") ?? "[]"),
    ).toEqual(["root:pages", "home"]);

    await userEvent.keyboard("{ArrowLeft}");
    await waitFor(() =>
      expect(screen.queryByRole("treeitem", { name: "About, Published" })).toBeNull(),
    );
  });

  it("creates under a page from its menu, offering only the allowed content types", async () => {
    window.localStorage.setItem("lintel.contentTree.expanded.main", '["root:pages"]');
    const api = answerTree();
    renderScreen(<ContentSection />, editor);

    const homeRow = await screen.findByRole("treeitem", { name: "Home, Draft" });
    fireEvent.contextMenu(homeRow.firstElementChild ?? homeRow);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Create…" }));

    const dialog = await screen.findByRole("dialog", { name: "Create in Home" });
    expect(
      within(dialog)
        .getAllByRole("radio")
        .map((radio) => radio.getAttribute("value")),
    ).toEqual(["pages"]);
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
    const aboutRow = await screen.findByRole("treeitem", { name: "About, Published" });
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
});
