import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { InlineMenuEditor } from "./InlineMenuEditor.js";
import { canvasMenuLinks } from "./builderMenus.js";
import type { Menu, MenuItem } from "./menus.types.js";

afterEach(() => vi.restoreAllMocks());

const page = (id: string, children: MenuItem[] = []): MenuItem => ({
  id: `item-${id}`,
  label: "",
  entryId: id,
  url: null,
  newTab: false,
  children,
});

const menu: Menu = {
  id: "n1",
  handle: "main",
  name: "Main menu",
  maxDepth: 2,
  source: "items",
  itemCount: 2,
  updatedAt: "2026-10-01T09:00:00.000Z",
  items: [page("home"), page("about")],
  pageTree: { includeHome: true, hiddenEntryIds: [], labels: {} },
  linkedEntries: {
    home: { title: "Home", collectionHandle: "pages", status: "published" },
    about: { title: "About", collectionHandle: "pages", status: "published" },
  },
};

describe("editing a menu from the page builder", () => {
  it("reorders and nests, then Done saves to the same menu the Menus screen edits", async () => {
    const api = mockApi(({ method, url, body }) => {
      if (url.pathname === "/navigation/main") {
        return method === "PUT" ? { ...menu, ...(body as object) } : menu;
      }
      return undefined;
    });
    const onClose = vi.fn();
    renderScreen(<InlineMenuEditor handle="main" onClose={onClose} />, { permissions: ["*"] });

    await userEvent.click(await screen.findByRole("button", { name: "Move “About” up" }));
    await userEvent.click(screen.getByRole("button", { name: "Put “Home” inside the link above" }));
    await userEvent.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const saved = api.calls.find((call) => call.method === "PUT");
    expect(saved?.url.pathname).toBe("/navigation/main");
    const items = (saved?.body as { items: MenuItem[] }).items;
    expect(items.map((item) => item.entryId)).toEqual(["about"]);
    expect(items[0]?.children.map((item) => item.entryId)).toEqual(["home"]);
  });

  it("gives the canvas the links with the pages' titles", () => {
    expect(canvasMenuLinks(menu.items, menu.linkedEntries).map((link) => link.label)).toEqual([
      "Home",
      "About",
    ]);
  });
});
