import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiErrorResponse, mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { MenuEditor } from "./MenuEditor.js";
import type { Menu, MenuItem } from "./menus.types.js";

function link(id: string, label: string, children: MenuItem[] = []): MenuItem {
  return { id, label, entryId: null, url: `/${id}`, newTab: false, children };
}

const menu: Menu = {
  id: "n1",
  handle: "main",
  name: "Main menu",
  maxDepth: 2,
  source: "items",
  itemCount: 2,
  updatedAt: "2026-10-01T09:00:00.000Z",
  items: [link("home", "Home"), link("shop", "Shop")],
  pageTree: { includeHome: true, hiddenEntryIds: [], labels: {} },
  linkedEntries: {},
};

function page(id: string, title: string, parentId: string | null, isSiteStart = false) {
  return {
    id,
    title,
    slug: id,
    status: "published",
    hasUnpublishedChanges: false,
    scheduledFor: null,
    updatedAt: "2026-10-01T09:00:00.000Z",
    parentId,
    locale: "en-GB",
    collection: { handle: "pages", name: "Pages" },
    childCount: 0,
    childrenAsCollection: false,
    isSiteStart,
    values: {},
    updatedBy: null,
    url: isSiteStart ? "/" : `/${id}`,
  };
}

const pages = {
  items: [
    page("p-home", "Home", null, true),
    page("p-about", "About", "p-home"),
    page("p-team", "Team", "p-about"),
    page("p-contact", "Contact", "p-home"),
  ],
  columns: [],
  types: [{ handle: "pages", name: "Pages" }],
  total: 4,
  page: 1,
  perPage: 100,
  canSortByHand: true,
};

function rowLabels() {
  const list = screen.getByRole("list", { name: "Menu items" });
  return within(list)
    .getAllByRole("button", { name: /^Edit/ })
    .map((button) => button.getAttribute("aria-label"));
}

afterEach(() => vi.restoreAllMocks());

describe("MenuEditor", () => {
  it("adds a link, nests it with the keyboard, and saves the tree", async () => {
    const api = mockApi(({ method, body }) =>
      method === "PUT" ? { ...menu, ...(body as object), linkedEntries: {} } : undefined,
    );
    renderScreen(<MenuEditor menu={menu} />);
    await screen.findByRole("heading", { name: "Main menu" });

    await userEvent.click(screen.getAllByRole("button", { name: "Add link" })[0]!);
    const sheet = await screen.findByRole("dialog", { name: "Add a link" });
    await userEvent.click(within(sheet).getByRole("radio", { name: "A web address" }));
    await userEvent.type(
      within(sheet).getByRole("textbox", { name: "A web address" }),
      "/gift-cards",
    );
    await userEvent.type(within(sheet).getByRole("textbox", { name: "Label" }), "Gift cards");
    await userEvent.click(within(sheet).getByRole("button", { name: "Add" }));

    expect(rowLabels()).toEqual(["Edit “Home”", "Edit “Shop”", "Edit “Gift cards”"]);
    await userEvent.click(
      screen.getByRole("button", { name: "Put “Gift cards” inside the link above" }),
    );
    expect(screen.getByText("“Gift cards” is now item 3 of 3, on level 2.")).toHaveAttribute(
      "role",
      "status",
    );
    // Two levels: it can't go deeper.
    expect(
      screen.getByRole("button", { name: "Put “Gift cards” inside the link above" }),
    ).toHaveAttribute("aria-disabled", "true");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.calls.some(({ method }) => method === "PUT")).toBe(true));
    const saved = api.calls.find(({ method }) => method === "PUT")?.body as { items: MenuItem[] };
    expect(saved.items.map((item) => item.label)).toEqual(["Home", "Shop"]);
    expect(saved.items[1]?.children).toEqual([
      expect.objectContaining({ label: "Gift cards", url: "/gift-cards", entryId: null }),
    ]);
  });

  it("shows the API's problem on the item it's about", async () => {
    mockApi(({ method }) => {
      if (method === "PUT") {
        throw apiErrorResponse(400, "INVALID_REQUEST", "Some fields need attention.", {
          shop: "The page this item linked to has been deleted",
        });
      }
      return undefined;
    });
    renderScreen(<MenuEditor menu={menu} />);
    await screen.findByRole("heading", { name: "Main menu" });

    await userEvent.click(screen.getByRole("button", { name: "Move “Shop” up" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("The page this item linked to has been deleted"),
    ).toBeInTheDocument();
    expect(rowLabels()).toEqual(["Edit “Shop”", "Edit “Home”"]);
  });

  it("adds several pages at once from the tree, nesting a page under its parent", async () => {
    const api = mockApi(({ method, url, body }) => {
      if (url.pathname.endsWith("/content-tree/items")) return pages;
      if (method === "PUT") return { ...menu, ...(body as object) };
      return undefined;
    });
    renderScreen(<MenuEditor menu={{ ...menu, items: [] }} />);

    await userEvent.click(await screen.findByRole("button", { name: "Add pages" }));
    const dialog = await screen.findByRole("dialog", { name: "Add pages to Main menu" });
    await userEvent.click(await within(dialog).findByRole("checkbox", { name: /About/ }));
    await userEvent.click(within(dialog).getByRole("checkbox", { name: /Team/ }));
    await userEvent.click(within(dialog).getByRole("checkbox", { name: /Contact/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Add 3 pages" }));

    expect(rowLabels()).toEqual(["Edit “About”", "Edit “Team”", "Edit “Contact”"]);
    const preview = screen.getByRole("region", { name: "Preview" });
    expect(within(preview).getByText("About")).toBeInTheDocument();
    expect(within(preview).getByText("Team")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.calls.some(({ method }) => method === "PUT")).toBe(true));
    const saved = api.calls.find(({ method }) => method === "PUT")?.body as { items: MenuItem[] };
    expect(saved.items.map((item) => item.entryId)).toEqual(["p-about", "p-contact"]);
    expect(saved.items[0]?.children.map((item) => item.entryId)).toEqual(["p-team"]);
  });

  it("makes a link a button, and shows it as one", async () => {
    const api = mockApi(({ method, body }) =>
      method === "PUT" ? { ...menu, ...(body as object) } : undefined,
    );
    renderScreen(<MenuEditor menu={menu} />);
    await userEvent.click(await screen.findByRole("button", { name: "Edit “Shop”" }));
    const sheet = await screen.findByRole("dialog");
    await userEvent.click(within(sheet).getByRole("switch", { name: "Show as a button" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Done" }));

    const list = screen.getByRole("list", { name: "Menu items" });
    expect(within(list).getByText("Button")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.calls.some(({ method }) => method === "PUT")).toBe(true));
    const saved = api.calls.find(({ method }) => method === "PUT")?.body as { items: MenuItem[] };
    expect(saved.items[1]).toMatchObject({ label: "Shop", style: "button" });
  });

  it("follows the page tree, hiding pages from it, and can go back to arranging it", async () => {
    const treeItems: MenuItem[] = [
      { id: "p-home", label: "", entryId: "p-home", url: null, newTab: false, children: [] },
      { id: "p-about", label: "", entryId: "p-about", url: null, newTab: false, children: [] },
    ];
    const linkedEntries = {
      "p-home": { title: "Home", collectionHandle: "pages", status: "published" as const },
      "p-about": { title: "About", collectionHandle: "pages", status: "published" as const },
    };
    const api = mockApi(({ method, body }) => {
      if (method !== "PUT") return undefined;
      const changes = body as Partial<Menu>;
      return {
        ...menu,
        source: changes.source ?? "pageTree",
        items: changes.source === "items" ? (changes.items ?? []) : treeItems,
        pageTree: changes.pageTree ?? menu.pageTree,
        linkedEntries,
      };
    });
    renderScreen(<MenuEditor menu={menu} />);
    const puts = () => api.calls.filter(({ method }) => method === "PUT");

    await userEvent.click(await screen.findByRole("radio", { name: "Follow the page tree" }));
    const ask = await screen.findByRole("alertdialog", { name: "Follow the page tree?" });
    await userEvent.click(within(ask).getByRole("button", { name: "Follow the page tree" }));
    expect(await screen.findByRole("button", { name: "Hide About from this menu" })).toBeTruthy();
    expect(puts()[0]?.body).toMatchObject({ source: "pageTree" });

    await userEvent.click(screen.getByRole("button", { name: "Hide About from this menu" }));
    expect(screen.getByRole("button", { name: "Show About" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(puts()).toHaveLength(2));
    expect(puts()[1]?.body).toEqual({
      pageTree: { includeHome: true, hiddenEntryIds: ["p-about"], labels: {} },
    });

    await userEvent.click(screen.getByRole("radio", { name: "I arrange it" }));
    const back = await screen.findByRole("alertdialog", { name: "Arrange this menu yourself?" });
    await userEvent.click(within(back).getByRole("button", { name: "Arrange it myself" }));
    await waitFor(() => expect(puts()).toHaveLength(3));
    expect(puts()[2]?.body).toMatchObject({ source: "items" });
  });
});
