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
  itemCount: 2,
  updatedAt: "2026-10-01T09:00:00.000Z",
  items: [link("home", "Home"), link("shop", "Shop")],
  linkedEntries: {},
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
});
