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
  skippedHome: false,
  replacedCount: 0,
  previousSectionsKept: false,
  featuresSwitchedOn: [],
};

const existingPages = {
  pageCount: 3,
  addedCount: 3,
  hasHome: true,
  clashes: [{ title: "Menu", slug: "menu", existingTitle: "Our menu" }],
};

async function openBakery(user: ReturnType<typeof userEvent.setup>) {
  const list = await screen.findByRole("list", { name: "Templates to start from" });
  const bakery = within(list).getByRole("article", { name: "Bakery and café" });
  await user.click(within(bakery).getByRole("button", { name: /Use this template/ }));
  return screen.getByRole("dialog", { name: "Start from Bakery and café?" });
}

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
    // Only the first letter is lowered, so names keep their capitals.
    expect(within(list).getByRole("article", { name: "Longplay" })).toHaveTextContent(
      "Good for bands, singers, DJs and other musicians",
    );

    await user.click(within(bakery).getByRole("button", { name: /Use this template/ }));
    const dialog = screen.getByRole("dialog", { name: "Start from Bakery and café?" });
    expect(
      within(dialog).getByRole("switch", { name: /colours, fonts, menu and footer, and motion/ }),
    ).toBeChecked();
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

  describe("on a site that has pages", () => {
    function answer() {
      return mockApi(({ method, url }) => {
        if (url.pathname === "/website/address") return { siteAddress: null, defaultLocale: "en" };
        if (url.pathname === "/starter-sites/bakery/existing-pages") return existingPages;
        if (method === "POST" && url.pathname === "/starter-sites/bakery/apply") {
          return { ...applied, skippedHome: true };
        }
        return undefined;
      });
    }

    it("doesn't promise to keep the site's pages when they are being replaced", async () => {
      const user = userEvent.setup();
      answer();
      renderScreen(<TemplateLibraryPage />, { permissions: ["*"] });
      const dialog = await openBakery(user);
      await user.click(await within(dialog).findByRole("radio", { name: /Replace my pages/ }));

      expect(dialog).toHaveAccessibleDescription(
        "We’ll add 4 pages to Pages, ready to change in the page builder.",
      );
    });

    it("adds the pages alongside by default, saying what happens to Home and clashes", async () => {
      const user = userEvent.setup();
      const { calls } = answer();
      renderScreen(<TemplateLibraryPage />, { permissions: ["*"] });
      const dialog = await openBakery(user);

      expect(await within(dialog).findByText("Your site already has pages")).toBeInTheDocument();
      expect(within(dialog).getByRole("radio", { name: /Add them alongside/ })).toBeChecked();
      expect(dialog).toHaveTextContent("is added as “Menu (2)”");
      // Beside the site's home page, the template's isn't added, and the count says so.
      expect(dialog).toHaveTextContent("We’ll add 3 pages");
      expect(dialog).toHaveTextContent(
        "The template’s home page isn’t added; your home page stays.",
      );
      // The template's look changes the live site, so beside the site's pages it starts off.
      const look = within(dialog).getByRole("switch", { name: /colours, fonts/ });
      expect(look).not.toBeChecked();
      expect(look).toHaveAccessibleDescription("Changes your live website now.");
      await user.click(within(dialog).getByRole("button", { name: "Add the pages" }));

      expect(await screen.findByText(/Your home page stayed as it was/)).toBeInTheDocument();
      expect(calls.find((call) => call.method === "POST")?.body).toMatchObject({
        existingPages: "alongside",
        useTheme: false,
      });
    });

    it("replaces the pages when chosen, and only for people who may delete", async () => {
      const user = userEvent.setup();
      const { calls } = answer();
      renderScreen(<TemplateLibraryPage />, { permissions: ["*"] });
      const dialog = await openBakery(user);

      await user.click(await within(dialog).findByRole("radio", { name: /Replace my pages/ }));
      // Replacing the site's pages, the template's look comes with them unless switched off.
      expect(within(dialog).getByRole("switch", { name: /colours, fonts/ })).toBeChecked();
      await user.click(within(dialog).getByRole("button", { name: "Add the pages" }));
      await screen.findByRole("heading", { name: "Your Bakery and café pages are ready" });
      expect(calls.find((call) => call.method === "POST")?.body).toMatchObject({
        existingPages: "replace",
        useTheme: true,
      });
    });

    it("keeps Replace from people who can't delete pages", async () => {
      const user = userEvent.setup();
      answer();
      renderScreen(<TemplateLibraryPage />, { permissions: ["entries:read", "entries:create"] });
      const dialog = await openBakery(user);
      expect(await within(dialog).findByRole("radio", { name: /Replace my pages/ })).toBeDisabled();
    });

    it("changes nothing when cancelled", async () => {
      const user = userEvent.setup();
      const { calls } = answer();
      renderScreen(<TemplateLibraryPage />, { permissions: ["*"] });
      const dialog = await openBakery(user);
      await within(dialog).findByText("Your site already has pages");
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(calls.some((call) => call.method === "POST")).toBe(false);
    });
  });
});
