import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { PluginEditorPanels } from "../plugins/PluginEditorPanels.js";
import { EntrySeoPanel } from "./EntrySeoPanel.js";
import { RedirectsPage } from "./RedirectsPage.js";
import type { Redirect, SeoDefaults } from "./seo.api.js";
import { breadcrumb } from "./SearchPreview.js";

const defaults: SeoDefaults = {
  siteName: "Corner Bakery",
  titleTemplate: "{title} | {siteName}",
  defaultDescription: "",
  defaultSocialImageId: null,
  discourageSearchEngines: false,
};

const suggestion: Redirect = {
  id: "r1",
  fromPath: "/about-us",
  toPath: "/about",
  statusCode: 301,
  status: "suggested",
  source: "automatic",
  entryId: "e1",
  updatedAt: "2026-10-31T09:00:00Z",
};

afterEach(() => vi.restoreAllMocks());

describe("the editor's search engines panel", () => {
  function servePanel() {
    return mockApi(({ method, url, body }) => {
      if (url.pathname === "/seo/defaults") return defaults;
      if (url.pathname === "/website/address") {
        return { siteAddress: "https://www.cornerbakery.example", defaultLocale: "en-GB" };
      }
      if (url.pathname === "/seo/entries/e1" && method === "GET") {
        return { title: "", description: "", socialImageId: null, noindex: false };
      }
      if (url.pathname === "/seo/entries/e1" && method === "PUT") return body;
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
  }

  it("previews the search result and saves what is typed", async () => {
    const { calls } = servePanel();
    renderScreen(
      <EntrySeoPanel
        entryId="e1"
        entryTitle="About us"
        slug="about"
        collection={{ handle: "pages", routePattern: "/{slug}" }}
      />,
      { enabledPlugins: ["seo"] },
    );

    const preview = await screen.findByRole("figure", { name: "Search result preview" });
    expect(await within(preview).findByText("About us | Corner Bakery")).toBeInTheDocument();
    expect(
      await within(preview).findByText("www.cornerbakery.example › about"),
    ).toBeInTheDocument();
    expect(screen.getByText(/24 of about 60 characters · A good length/)).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText("Description"),
      "Three generations of baking on the same corner of the high street.",
    );
    expect(screen.getByText(/66 of about 160 characters · A good length/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("switch", { name: "Hide from search engines" }));

    await waitFor(
      () =>
        expect(calls.filter((call) => call.method === "PUT").at(-1)?.body).toEqual({
          title: "",
          description: "Three generations of baking on the same corner of the high street.",
          socialImageId: null,
          noindex: true,
        }),
      { timeout: 3000 },
    );
  });

  it("warns when a title will be cut off", async () => {
    servePanel();
    renderScreen(
      <EntrySeoPanel
        entryId="e1"
        entryTitle="Our complete guide to sourdough, rye, spelt and everything in between"
        slug="guide"
        collection={{ handle: "pages", routePattern: "/{slug}" }}
      />,
      { enabledPlugins: ["seo"] },
    );

    expect(await screen.findByText(/· May be cut off/)).toBeInTheDocument();
  });

  it("is in the editor's side panel only while the plugin is on", async () => {
    servePanel();
    const entry = {
      entryId: "e1",
      entryTitle: "Hi",
      slug: "hi",
      collection: { handle: "pages", routePattern: null },
    };
    renderScreen(<PluginEditorPanels {...entry} />, { enabledPlugins: [] });
    expect(screen.queryByText("Search engines")).not.toBeInTheDocument();
    cleanup();

    renderScreen(<PluginEditorPanels {...entry} />, { enabledPlugins: ["seo"] });
    expect(await screen.findByText("Search engines")).toBeInTheDocument();
  });
});

describe("the redirects screen", () => {
  it("offers suggestions to accept or dismiss", async () => {
    const { calls } = mockApi(({ method, url }) => {
      if (url.pathname === "/seo/redirects" && method === "GET") return { redirects: [suggestion] };
      if (method === "PATCH") return { ...suggestion, status: "active" };
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    renderScreen(<RedirectsPage />, { enabledPlugins: ["seo"] });

    expect(await screen.findByText("/about-us → /about")).toBeInTheDocument();
    expect(screen.getByText("No redirects yet")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Accept the redirect from /about-us" }),
    );

    expect(calls.find((call) => call.method === "PATCH")).toMatchObject({
      url: expect.objectContaining({ pathname: "/seo/redirects/r1" }),
      body: { status: "active" },
    });
  });

  it("imports a CSV and reports skipped lines", async () => {
    mockApi(({ method, url }) => {
      if (url.pathname === "/seo/redirects" && method === "GET") return { redirects: [] };
      if (url.pathname === "/seo/redirects/import") {
        return {
          added: 2,
          updated: 0,
          problems: [{ line: 3, message: "Please enter the new address" }],
        };
      }
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    renderScreen(<RedirectsPage />, { enabledPlugins: ["seo"] });

    await userEvent.click(await screen.findByRole("button", { name: "Import CSV" }));
    const dialog = screen.getByRole("dialog", { name: "Import redirects" });
    await userEvent.type(within(dialog).getByLabelText("Or paste the rows"), "/a,/b");
    await userEvent.click(within(dialog).getByRole("button", { name: "Import CSV" }));

    const done = await screen.findByRole("dialog", { name: "Import finished" });
    expect(within(done).getByText("2 added and 0 updated.")).toBeInTheDocument();
    expect(within(done).getByText("Line 3: Please enter the new address")).toBeInTheDocument();
  });
});

describe("breadcrumbs", () => {
  it("read like a search result's address", () => {
    expect(breadcrumb("https://example.com/blog/hello")).toBe("example.com › blog › hello");
    expect(breadcrumb("/blog/hello")).toBe("blog › hello");
    expect(breadcrumb("/")).toBe("/");
  });
});
