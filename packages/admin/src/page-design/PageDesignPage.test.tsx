import { createEmptyPage } from "@lintel/builder-model";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Entry } from "../content/content.types.js";
import { postsCollection, samplePost } from "../content/testEntries.js";
import { apiErrorResponse, mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { PageDesignPage } from "./PageDesignPage.js";
import { PageFieldEditor } from "./PageFieldEditor.js";

function samplePage(design: unknown = null): Entry {
  const post = samplePost();
  return samplePost({
    data: { title: "Home", design },
    blueprint: {
      ...post.blueprint,
      fields: [
        { handle: "title", label: "Title", type: "text", required: true, options: {} },
        { handle: "design", label: "Design", type: "page", required: false, options: {} },
      ],
    },
  });
}

afterEach(() => vi.restoreAllMocks());

/** Past the first-time tour, then a section from Insert, as an empty page offers. */
async function addSection(user: ReturnType<typeof userEvent.setup>, search: string, name: string) {
  await screen.findByRole("heading", { name: "This page is empty" });
  if (screen.queryByRole("dialog", { name: "Add sections and elements" })) {
    await user.keyboard("{Escape}");
  }
  await user.click(screen.getByRole("button", { name: "Add a section" }));
  await user.keyboard(search);
  await user.click(
    within(screen.getByRole("region", { name: "Sections" })).getByRole("button", { name }),
  );
}

describe("a page design field", () => {
  const props = {
    field: {
      handle: "design",
      label: "Design",
      type: "page" as const,
      required: false,
      options: {},
    },
    onChange: () => undefined,
    controlId: "design",
    labelId: "design-label",
    describedBy: undefined,
    hasError: false,
    innerErrors: {},
    renderField: () => null,
  };

  it("asks for the entry to be saved before it can be designed", async () => {
    renderScreen(<PageFieldEditor {...props} value={createEmptyPage()} />);
    expect(await screen.findByText(/Give the entry a title first/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit design" })).not.toBeInTheDocument();
  });
});

describe("the page design screen", () => {
  it("opens an empty page with a way to start, and saves what is added", async () => {
    const user = userEvent.setup();
    const { calls } = mockApi(({ method, url, body }) => {
      if (method === "GET" && url.pathname === "/entries/p1") return samplePage();
      if (method === "PATCH" && url.pathname === "/entries/p1") {
        return samplePage((body as { data: { design: unknown } }).data.design);
      }
      throw apiErrorResponse(404, "NOT_FOUND", "Not found");
    });
    renderScreen(<PageDesignPage collectionHandle="pages" entryId="p1" fieldHandle="design" />);
    await addSection(user, "call to action", "Call to action");
    await waitFor(() => expect(calls.some((call) => call.method === "PATCH")).toBe(true), {
      timeout: 4000,
    });
    const saved = calls.find((call) => call.method === "PATCH")?.body as {
      data: { design: { root: { children: Array<{ name: string }> } } };
    };
    expect(saved.data.design.root.children[0]?.name).toBe("Call to action");
    expect((await screen.findAllByText("Saved")).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Home" })).toBeInTheDocument();
  });

  it("saves a Navigation for the whole site, keeping it out of the page", async () => {
    const user = userEvent.setup();
    const { calls } = mockApi(({ method, url, body }) => {
      if (method === "GET" && url.pathname === "/entries/p1") return samplePage();
      if (method === "PATCH" && url.pathname === "/entries/p1") {
        return samplePage((body as { data: { design: unknown } }).data.design);
      }
      if (method === "GET" && url.pathname === "/website/sections") {
        return { navigation: null, footer: null };
      }
      if (method === "PUT" && url.pathname === "/website/sections") {
        return { navigation: (body as { navigation: unknown }).navigation, footer: null };
      }
      throw apiErrorResponse(404, "NOT_FOUND", "Not found");
    });
    renderScreen(<PageDesignPage collectionHandle="pages" entryId="p1" fieldHandle="design" />);
    await addSection(user, "call to action", "Call to action");
    await user.click(screen.getByRole("tab", { name: "Insert" }));
    await user.clear(screen.getByRole("searchbox", { name: "Search sections and elements" }));
    await user.keyboard("logo and menu");
    await user.click(screen.getByRole("button", { name: /^Logo and menu/ }));
    await waitFor(() => expect(calls.some((call) => call.method === "PUT")).toBe(true), {
      timeout: 4000,
    });
    const put = calls.find((call) => call.method === "PUT")?.body as {
      navigation: { id: string; props: { element: string } };
    };
    expect(put.navigation).toMatchObject({ id: "site-navigation", props: { element: "header" } });
    await waitFor(
      () => {
        const patches = calls.filter((call) => call.method === "PATCH");
        expect(patches.length).toBeGreaterThan(0);
        expect(JSON.stringify(patches.at(-1)?.body ?? {})).not.toContain("site-navigation");
      },
      { timeout: 4000 },
    );
  });

  it("shows the server’s message when it refuses a design", async () => {
    const user = userEvent.setup();
    mockApi(({ method, url }) => {
      if (method === "GET" && url.pathname.includes("/entries/")) return samplePage();
      throw apiErrorResponse(400, "INVALID_FIELDS", "Some fields need attention", {
        design: "Design: only people allowed to edit code can add or change code.",
      });
    });
    renderScreen(<PageDesignPage collectionHandle="pages" entryId="p1" fieldHandle="design" />, {
      permissions: ["entries:*"],
    });
    await addSection(user, "hero", "Hero");
    expect(await screen.findByRole("alert", {}, { timeout: 4000 })).toHaveTextContent(
      "only people allowed to edit code",
    );
    expect(screen.queryByRole("tab", { name: "Code" })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("banner")).getByRole("button", { name: "Publish" }),
    ).toBeInTheDocument();
  });

  it("draws the canvas with the website's own look, header and footer", async () => {
    mockApi(({ method, url }) => {
      if (method === "GET" && url.pathname === "/website/canvas") {
        return {
          stylesheet: ".lintel-site { color: #222; }",
          bodyClassName: "lintel-site lintel-template-clean",
          headerHtml: '<header class="lintel-header">Corner Bakery</header>',
          footerHtml: '<footer class="lintel-footer">Fresh bread</footer>',
          baseUrl: "http://localhost:3000",
          motionScript: "",
        };
      }
      // Only the page itself: the site's motion settings and effect modules aren't set up.
      if (method === "GET" && url.pathname.startsWith("/entries/")) return samplePage();
      throw apiErrorResponse(404, "NOT_FOUND", "Not found");
    });
    renderScreen(<PageDesignPage collectionHandle="pages" entryId="p1" fieldHandle="design" />);
    await addSection(userEvent.setup(), "hero", "Hero");
    const canvas = await screen.findByTitle("Your page");
    const source = canvas.getAttribute("srcdoc") ?? "";
    expect(source).toContain('<base href="http://localhost:3000">');
    expect(source).toContain('<body class="lintel-site lintel-template-clean">');
    expect(source).toContain("Corner Bakery");
    expect(source).toContain('<div id="lintel-page" class="lintel-design">');
  });

  it("offers View page beside Publish once the page is live, for the tour to point at", async () => {
    mockApi(({ method, url }) => {
      if (method === "GET" && url.pathname === "/entries/p1") {
        return { ...samplePage(), slug: "about", status: "published", locale: "en-GB" };
      }
      if (method === "GET" && url.pathname === "/collections/pages") {
        return { ...postsCollection, handle: "pages", routePattern: "/{slug}" };
      }
      if (method === "GET" && url.pathname === "/website/address") {
        return { siteAddress: "https://bakery.example", defaultLocale: "en-GB" };
      }
      throw apiErrorResponse(404, "NOT_FOUND", "Not found");
    });
    renderScreen(<PageDesignPage collectionHandle="pages" entryId="p1" fieldHandle="design" />, {
      permissions: ["entries:*"],
    });
    const viewPage = await screen.findByRole("link", { name: "View page" });
    expect(viewPage).toHaveAttribute("href", "https://bakery.example/about");
    expect(viewPage.closest("[data-tour='publish']")).toContainElement(
      within(screen.getByRole("banner")).getByRole("button", { name: "Publish" }),
    );
  });

  // Publishing used to give no sign at all, and nothing said the saved page wasn't live.
  it("says the page isn't on the site yet, and confirms when Publish has worked", async () => {
    const user = userEvent.setup();
    mockApi(({ method, url }) => {
      if (method === "GET" && url.pathname === "/entries/p1") return samplePage();
      if (method === "POST" && url.pathname === "/entries/p1/publish") {
        return { ...samplePage(), status: "published", hasUnpublishedChanges: false };
      }
      throw apiErrorResponse(404, "NOT_FOUND", "Not found");
    });
    renderScreen(<PageDesignPage collectionHandle="pages" entryId="p1" fieldHandle="design" />);
    const banner = await screen.findByRole("banner");
    expect(await within(banner).findByText("Not on your site yet")).toBeInTheDocument();

    await user.click(within(banner).getByRole("button", { name: "Publish" }));

    expect(await within(banner).findByRole("button", { name: "Published" })).toBeInTheDocument();
    expect(
      screen.getByText("Published. Your changes are on your site.", { selector: "[role=status]" }),
    ).toBeInTheDocument();
    expect(within(banner).queryByText("Not on your site yet")).not.toBeInTheDocument();
  });

  // On a phone the builder spilled 640px past the screen and the tour still ran.
  it("says the designer needs a bigger screen on a phone, with ways on", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("max-width"),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    mockApi(({ method, url }) => {
      if (method === "GET" && url.pathname === "/entries/p1") return samplePage();
      throw apiErrorResponse(404, "NOT_FOUND", "Not found");
    });
    renderScreen(<PageDesignPage collectionHandle="pages" entryId="p1" fieldHandle="design" />);

    expect(
      await screen.findByRole("heading", { name: "The designer needs a bigger screen" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Home" })).toBeInTheDocument();
    expect(screen.queryByTitle("Your page")).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
