import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { AdminLayout } from "./AdminLayout.js";

afterEach(() => vi.restoreAllMocks());

// Which widths fold the sidebar away is CSS (`max-md:`); jsdom has no layout, so these
// check the parts that make it work on a phone: the button, the open state and the focus.
describe("the admin's frame on a phone", () => {
  function renderLayout() {
    mockApi(({ url }) => {
      if (url.pathname === "/updates/status") return { updating: false, version: null };
      if (url.pathname === "/sites") return { sites: [] };
      return {};
    });
    return renderScreen(
      <AdminLayout permissions={["entries:read"]} enabledPlugins={[]} siteName="Brightside" />,
    );
  }

  it("folds the sidebar away behind a menu button, and opens it over the page", async () => {
    renderLayout();
    const menu = await screen.findByRole("button", { name: "Open the menu" });
    const sidebar = document.getElementById("admin-sidebar");
    const main = document.getElementById("main");
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveAttribute("aria-controls", "admin-sidebar");
    expect(sidebar).toHaveClass("max-md:hidden");
    // The page itself has the whole width on a phone; the sidebar's room is kept from md up.
    expect(main).toHaveClass("md:ps-[264px]");
    expect(main?.className).not.toMatch(/(^|\s)ps-\[264px\]/);

    await userEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(sidebar).not.toHaveClass("max-md:hidden");
    expect(main).toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "Close the menu" })).toHaveFocus();
  });

  it("closes with Escape or its close button, and gives focus back to the menu button", async () => {
    renderLayout();
    const menu = await screen.findByRole("button", { name: "Open the menu" });
    const sidebar = document.getElementById("admin-sidebar");

    await userEvent.click(menu);
    await userEvent.keyboard("{Escape}");
    expect(sidebar).toHaveClass("max-md:hidden");
    expect(menu).toHaveFocus();

    await userEvent.click(menu);
    await userEvent.click(screen.getByRole("button", { name: "Close the menu" }));
    expect(sidebar).toHaveClass("max-md:hidden");
    expect(document.getElementById("main")).not.toHaveAttribute("inert");
    expect(menu).toHaveFocus();
  });
});
