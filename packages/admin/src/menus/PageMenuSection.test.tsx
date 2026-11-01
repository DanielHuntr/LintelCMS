import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContentSection } from "../content-tree/ContentSection.js";
import { testNode } from "../content-tree/testTree.js";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { PageMenuSection } from "./PageMenuSection.js";

afterEach(() => vi.restoreAllMocks());

const mainMenu = { handle: "main", name: "Main menu", source: "items" };

describe("“In the main menu” in a page's settings", () => {
  it("adds the page to the main menu and gives it a label there", async () => {
    let state = { menu: mainMenu, inMenu: false, label: "" };
    const api = mockApi(({ method, url, body }) => {
      if (url.pathname === "/navigation/main/pages/e1") {
        if (method === "PUT") state = { ...state, ...(body as object) };
        return state;
      }
      return undefined;
    });
    renderScreen(<PageMenuSection entryId="e1" pageTitle="About us" />, { permissions: ["*"] });

    const toggle = await screen.findByRole("switch", { name: "In the main menu" });
    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "In the main menu" })).toBeChecked(),
    );
    const label = screen.getByRole("textbox", { name: "Menu label" });
    expect(label).toHaveAttribute("placeholder", "About us");
    await userEvent.type(label, "About");
    await userEvent.tab();

    await waitFor(() =>
      expect(api.calls.filter((call) => call.method === "PUT").map((call) => call.body)).toEqual([
        { inMenu: true, label: "" },
        { inMenu: true, label: "About" },
      ]),
    );
    await userEvent.click(screen.getByRole("switch", { name: "In the main menu" }));
    await waitFor(() =>
      expect(api.calls.filter((call) => call.method === "PUT").at(-1)?.body).toEqual({
        inMenu: false,
        label: "About",
      }),
    );
  });

  it("says when the main menu follows the page tree", async () => {
    mockApi(() => ({ menu: { ...mainMenu, source: "pageTree" }, inMenu: true, label: "" }));
    renderScreen(<PageMenuSection entryId="e1" pageTitle="About" />, { permissions: ["*"] });
    expect(await screen.findByText(/follows the page tree/)).toBeInTheDocument();
  });

  it("can't be changed without permission to change menus", async () => {
    mockApi(() => ({ menu: mainMenu, inMenu: true, label: "" }));
    renderScreen(<PageMenuSection entryId="e1" pageTitle="About" />, {
      permissions: ["navigation:read", "entries:*"],
    });
    expect(await screen.findByRole("switch", { name: "In the main menu" })).toBeDisabled();
  });
});

describe("“In the main menu” when creating a page", () => {
  beforeEach(() =>
    window.localStorage.setItem("lintel.contentTree.expanded.main", '["root:pages"]'),
  );
  afterEach(() => window.localStorage.clear());

  const home = testNode({ id: "home", title: "Home", childCount: 1, isSiteStart: true });
  const about = testNode({ id: "about", title: "About", parentId: "home" });

  function answer() {
    return mockApi(({ method, url }) => {
      const path = url.pathname;
      if (path.endsWith("/content-tree")) {
        return {
          sites: [{ id: "s1", name: "Site", locale: "en-GB" }],
          site: { id: "s1", name: "Site", locale: "en-GB" },
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
          ],
          siteStartCount: 1,
          recycleBinCount: 0,
        };
      }
      if (path.endsWith("/content-tree/children")) {
        const items = url.searchParams.get("parentId") === "home" ? [about] : [home];
        return { items, total: items.length, offset: 0, limit: 100 };
      }
      if (path.endsWith("/content-tree/allowed-types")) {
        return {
          types: [{ handle: "pages", name: "Pages", blueprintHandle: "page", structure: "tree" }],
        };
      }
      if (method === "POST" && path.endsWith("/collections/pages/entries")) {
        return { ...about, id: "new-page", collectionHandle: "pages" };
      }
      if (method === "PUT" && path === "/navigation/main/pages/new-page") {
        return { menu: mainMenu, inMenu: true, label: "" };
      }
      return undefined;
    });
  }

  async function createIn(rowName: RegExp) {
    const row = await screen.findByRole("treeitem", { name: rowName });
    fireEvent.contextMenu(row.firstElementChild ?? row);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Create…" }));
    return screen.findByRole("dialog", { name: /^Create in/ });
  }

  it("is on for a page right under the home page, and puts it in the menu", async () => {
    const api = answer();
    renderScreen(<ContentSection />, { permissions: ["*"], initialPath: "/content" });
    const dialog = await createIn(/^Home/);

    const toggle = within(dialog).getByRole("switch", { name: "In the main menu" });
    expect(toggle).toBeChecked();
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Name" }), "Services");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(
        api.calls.find((call) => call.url.pathname === "/navigation/main/pages/new-page")?.body,
      ).toEqual({ inMenu: true }),
    );
  });

  it("is off for deeper pages", async () => {
    window.localStorage.setItem("lintel.contentTree.expanded.main", '["root:pages","home"]');
    const api = answer();
    renderScreen(<ContentSection />, { permissions: ["*"], initialPath: "/content" });
    const dialog = await createIn(/^About/);

    expect(within(dialog).getByRole("switch", { name: "In the main menu" })).not.toBeChecked();
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Name" }), "Team");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create" }));
    await waitFor(() => expect(api.calls.some((call) => call.method === "POST")).toBe(true));
    expect(api.calls.some((call) => call.url.pathname.startsWith("/navigation/main/pages/"))).toBe(
      false,
    );
  });
});
