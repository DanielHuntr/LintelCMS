import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { TemplateLibraryPage } from "./TemplateLibraryPage.js";

const applied = {
  starterSiteId: "bakery",
  pages: [
    { entryId: "e1", title: "Home", slug: "home", wantedSlug: "home", published: false },
    { entryId: "e2", title: "Menu", slug: "menu-2", wantedSlug: "menu", published: false },
  ],
  themeApplied: true,
  menuFilled: true,
  menuHasLinks: false,
};

describe("the template library", () => {
  it("lists the templates and adds one's pages, then links to the builder", async () => {
    const user = userEvent.setup();
    const { calls } = mockApi(({ method, url }) => {
      if (url.pathname === "/website/address")
        return { siteAddress: "http://localhost:3000", defaultLocale: "en" };
      if (method === "POST" && url.pathname === "/starter-sites/bakery/apply") return applied;
      return undefined;
    });
    renderScreen(<TemplateLibraryPage />, { permissions: ["*"] });
    expect(await screen.findByRole("heading", { level: 1, name: "Templates" })).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Templates to start from" });
    expect(within(list).getAllByRole("listitem").length).toBeGreaterThanOrEqual(6);
    const bakery = within(list).getByRole("article", { name: "Bakery and café" });
    expect(bakery).toHaveTextContent("Home · Menu · Our story · Visit us");

    await user.click(within(bakery).getByRole("button", { name: /Use this template/ }));
    const dialog = screen.getByRole("dialog", { name: "Start from Bakery and café?" });
    expect(within(dialog).getByRole("switch", { name: /colours and fonts/ })).toBeChecked();
    await user.click(within(dialog).getByRole("switch", { name: /Publish the pages/ }));
    await user.click(within(dialog).getByRole("button", { name: "Add the pages" }));

    expect(
      await screen.findByRole("heading", { name: "Your Bakery and café pages are ready" }),
    ).toHaveFocus();
    expect(calls.find((call) => call.method === "POST")?.body).toEqual({
      useTheme: true,
      publish: true,
    });
    expect(screen.getByRole("link", { name: "Edit Home" })).toHaveAttribute(
      "href",
      "/content/pages/e1/design/design",
    );
    expect(
      screen.getByText("Saved at /menu-2, because /menu was already in use."),
    ).toBeInTheDocument();
  });

  it("offers to add the pages to a main menu that already had links", async () => {
    const user = userEvent.setup();
    const { calls } = mockApi(({ method, url }) => {
      if (url.pathname === "/website/address") return { siteAddress: null, defaultLocale: "en" };
      if (method === "POST" && url.pathname === "/starter-sites/bakery/apply")
        return { ...applied, menuFilled: false, menuHasLinks: true };
      if (method === "POST" && url.pathname === "/starter-sites/menu") return { added: 2 };
      return undefined;
    });
    renderScreen(<TemplateLibraryPage />, { permissions: ["*"] });
    const list = await screen.findByRole("list", { name: "Templates to start from" });
    const bakery = within(list).getByRole("article", { name: "Bakery and café" });
    await user.click(within(bakery).getByRole("button", { name: /Use this template/ }));
    await user.click(screen.getByRole("button", { name: "Add the pages" }));

    expect(
      await screen.findByText("Your main menu already has links, so we left it as it is."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add these pages to the menu" }));
    expect(await screen.findByText("Added to your main menu.")).toBeInTheDocument();
    expect(calls.find((call) => call.url.pathname === "/starter-sites/menu")?.body).toEqual({
      entryIds: ["e1", "e2"],
    });
  });

  it("only offers what the person may do", async () => {
    const user = userEvent.setup();
    mockApi(() => undefined);
    renderScreen(<TemplateLibraryPage />, { permissions: ["entries:read", "entries:create"] });
    await user.click((await screen.findAllByRole("button", { name: /Use this template/ }))[0]!);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("switch")).not.toBeInTheDocument();
  });
});
