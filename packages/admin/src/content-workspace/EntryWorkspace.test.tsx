import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { postsCollection, samplePost } from "../content/testEntries.js";
import { WithTestTree } from "../content-tree/testTree.js";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { EntryWorkspace } from "./EntryWorkspace.js";
import type { WorkspaceTab } from "./workspaceTabs.js";

afterEach(() => vi.restoreAllMocks());

const info = {
  id: "p1",
  url: "/blog/hello-world",
  urls: ["/blog/hello-world"],
  siteStart: null as null | Record<string, unknown>,
  collection: {
    handle: "posts",
    name: "Blog posts",
    structure: "dated",
    routePattern: "/blog/{slug}",
  },
  createdAt: "2026-10-01T09:00:00.000Z",
  createdBy: { id: "u1", name: "Ada Lovelace" },
  updatedAt: "2026-10-01T09:00:00.000Z",
  updatedBy: null,
  publishedAt: null,
  scheduledFor: null,
  usedBy: [],
  childCount: 0,
  childrenAsCollection: false,
  unpublishedAncestors: [] as Array<{ id: string; title: string }>,
};

function answerWorkspace(infoChanges: Partial<typeof info> = {}) {
  return mockApi(({ method, url }) => {
    const path = url.pathname;
    if (path.endsWith("/info")) return { ...info, ...infoChanges };
    if (path.endsWith("/path")) {
      return {
        path: [
          { id: "p1", title: "Hello world", collection: { handle: "posts", name: "Blog posts" } },
        ],
      };
    }
    if (path.endsWith("/website/address")) return { siteAddress: null, defaultLocale: "en-GB" };
    if (path.endsWith("/revisions")) return { revisions: [] };
    if (method === "PATCH")
      return samplePost({ data: { title: "Hello there", excerpt: "", category: null } });
    throw new Error(`Unexpected ${method} ${path}`);
  });
}

function renderWorkspace(tab?: WorkspaceTab, onTabChange = vi.fn()) {
  return renderScreen(
    <WithTestTree>
      <EntryWorkspace
        collection={postsCollection}
        initialEntry={samplePost()}
        tab={tab}
        isPreviewOpen={false}
        onTabChange={onTabChange}
        onPreviewChange={vi.fn()}
      />
    </WithTestTree>,
    { initialPath: "/content/posts/p1" },
  );
}

describe("an entry's workspace", () => {
  it("has a header with breadcrumbs, its name to edit in place, and tabs", async () => {
    answerWorkspace();
    const onTabChange = vi.fn();
    renderWorkspace(undefined, onTabChange);

    const breadcrumbs = await screen.findByRole("navigation", { name: "Where it is" });
    expect(within(breadcrumbs).getByRole("link", { name: "Blog posts" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveProperty("value", "Hello world");
    const tabs = screen.getByRole("tablist", { name: "Sections of Hello world" });
    expect(
      within(tabs)
        .getAllByRole("tab")
        .map((tab) => tab.textContent),
    ).toEqual(["Content", "Settings", "History", "Info"]);

    within(tabs).getByRole("tab", { name: "Content" }).focus();
    await userEvent.keyboard("{End}");
    expect(onTabChange).toHaveBeenCalledWith("info");
  });

  it("shows the Info tab: address, who made it, its id", async () => {
    answerWorkspace();
    renderWorkspace("info");

    expect(await screen.findByText("/blog/hello-world")).toBeTruthy();
    expect(screen.getByText(/by Ada Lovelace/)).toBeTruthy();
    expect(screen.getByText("p1")).toBeTruthy();
    expect(screen.getByText("Nothing links to this yet.")).toBeTruthy();
  });

  it("shows where a page at the top of the site is, and why", async () => {
    answerWorkspace({
      url: "/",
      urls: ["/"],
      siteStart: { isDefault: true, isAssigned: false, hostname: "", pathPrefix: "" },
    });
    renderWorkspace("info");

    expect(await screen.findByText("The home page, as the first page at the top")).toBeTruthy();
    expect(screen.getByText("Top of the site")).toBeTruthy();
    // The header shows the address itself, not the slug the home page doesn't use.
    expect(screen.queryByRole("textbox", { name: "URL:" })).toBeNull();
  });

  it("asks before opening another node with unsaved changes", async () => {
    answerWorkspace();
    const { router } = renderWorkspace();

    await userEvent.type(await screen.findByRole("textbox", { name: "Title" }), "!");
    void router.navigate({
      to: "/content/$collection/$entryId",
      params: { collection: "posts", entryId: "p2" },
    });

    const dialog = await screen.findByRole("alertdialog", { name: "Leave without saving?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(router.state.location.pathname).toBe("/content/posts/p1");
  });

  it("saves and publishes from the bar along the bottom", async () => {
    const api = mockApi(({ method, url }) => {
      const path = url.pathname;
      if (path.endsWith("/info")) return info;
      if (path.endsWith("/path")) return { path: [] };
      if (path.endsWith("/website/address")) return { siteAddress: null, defaultLocale: "en-GB" };
      if (method === "PATCH") return samplePost();
      if (method === "POST" && path.endsWith("/publish"))
        return samplePost({ status: "published" });
      throw new Error(`Unexpected ${method} ${path}`);
    });
    renderWorkspace();

    const bar = await screen.findByRole("region", { name: "Saving and publishing" });
    await userEvent.click(within(bar).getByRole("button", { name: "Save and publish" }));

    await waitFor(() =>
      expect(api.calls.some((call) => call.url.pathname.endsWith("/entries/p1/publish"))).toBe(
        true,
      ),
    );
    // Live with nothing new: the bar says so, and offers the rarer choices in one menu.
    expect(await within(bar).findByText("Live on your site")).toBeTruthy();
    expect(within(bar).queryByRole("button", { name: "Published" })).toBeNull();
    await userEvent.click(within(bar).getByRole("button", { name: "Publishing options" }));
    expect(screen.getByRole("menuitem", { name: "Schedule…" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Unpublish" })).toBeTruthy();
  });

  // The bar showed a greyed-out "Published" and a Save with nothing to save, so people
  // couldn't tell where the page stood or what to press.
  it("says where the page stands in words, with Save only when there's something to save", async () => {
    answerWorkspace();
    renderWorkspace();

    const bar = await screen.findByRole("region", { name: "Saving and publishing" });
    expect(within(bar).getByText("Draft, not on your site yet")).toBeTruthy();
    expect(within(bar).queryByRole("button", { name: "Save" })).toBeNull();
    expect(within(bar).getByRole("button", { name: "Save and publish" })).toBeTruthy();

    await userEvent.type(screen.getByRole("textbox", { name: "Title" }), "!");
    expect(within(bar).getByRole("button", { name: "Save" })).toBeTruthy();
  });

  // Saving used to send the parent the editor opened with, so a page moved in the tree
  // meanwhile was quietly moved back on the next autosave.
  it("saves without saying where the page sits, so a move made in the tree stays", async () => {
    const api = answerWorkspace();
    renderWorkspace();

    await userEvent.type(await screen.findByRole("textbox", { name: "Title" }), "!");
    await userEvent.keyboard("{Control>}s{/Control}");

    await waitFor(() => expect(api.calls.some((call) => call.method === "PATCH")).toBe(true));
    const saved = api.calls.find((call) => call.method === "PATCH");
    expect(saved?.body).toMatchObject({ data: { title: "Hello world!" } });
    expect(saved?.body).not.toHaveProperty("parentId");
  });

  // LINTEL-DATA-004: every save sent every field, so a second editor's save put back the
  // values they had opened, over the first editor's saved changes.
  it("saves only the fields changed here, so someone else's changes to the rest are kept", async () => {
    const api = answerWorkspace();
    renderWorkspace();

    await userEvent.type(await screen.findByRole("textbox", { name: "Title" }), "!");
    await userEvent.keyboard("{Control>}s{/Control}");

    await waitFor(() => expect(api.calls.some((call) => call.method === "PATCH")).toBe(true));
    const saved = api.calls.find((call) => call.method === "PATCH")?.body as {
      data: Record<string, unknown>;
    };
    expect(Object.keys(saved.data)).toEqual(["title"]);
    expect(saved).not.toHaveProperty("slug");
  });

  describe("publishing a page whose parent isn't published", () => {
    function answerPublishing() {
      return mockApi(({ method, url }) => {
        const path = url.pathname;
        if (path.endsWith("/info"))
          return { ...info, unpublishedAncestors: [{ id: "h1", title: "Home" }] };
        if (path.endsWith("/path")) return { path: [] };
        if (path.endsWith("/website/address")) return { siteAddress: null, defaultLocale: "en-GB" };
        if (method === "PATCH") return samplePost();
        if (method === "POST" && path === "/content-tree/bulk")
          return { changed: ["h1"], skipped: [] };
        if (method === "POST" && path.endsWith("/publish"))
          return samplePost({ status: "published" });
        throw new Error(`Unexpected ${method} ${path}`);
      });
    }
    const posts = (api: ReturnType<typeof answerPublishing>) =>
      api.calls
        .filter((call) => call.method === "POST")
        .map((call) => ({ path: call.url.pathname, body: call.body }));

    async function pressSaveAndPublish() {
      const bar = await screen.findByRole("region", { name: "Saving and publishing" });
      await waitFor(() =>
        expect(within(bar).getByRole("button", { name: "Save and publish" })).toBeEnabled(),
      );
      // The question needs the page's info (shown on the Info tab), which loads beside it.
      await screen.findByText("/blog/hello-world");
      await userEvent.click(within(bar).getByRole("button", { name: "Save and publish" }));
      return screen.findByRole("alertdialog", { name: "Its parent page isn’t published" });
    }

    it("explains, and publishes the parent first when asked", async () => {
      const api = answerPublishing();
      renderWorkspace("info");

      const question = await pressSaveAndPublish();
      expect(question).toHaveTextContent(
        "“Hello world” is under “Home”, which isn’t on your website yet.",
      );
      expect(posts(api)).toEqual([]);
      await userEvent.click(
        within(question).getByRole("button", { name: "Publish with its parent" }),
      );

      await waitFor(() =>
        expect(posts(api)).toEqual([
          { path: "/content-tree/bulk", body: { action: "publish", entryIds: ["h1"] } },
          { path: "/entries/p1/publish", body: undefined },
        ]),
      );
    });

    it("can still publish the page on its own", async () => {
      const api = answerPublishing();
      renderWorkspace("info");

      const question = await pressSaveAndPublish();
      await userEvent.click(
        within(question).getByRole("button", { name: "Publish this page only" }),
      );

      await waitFor(() =>
        expect(posts(api)).toEqual([{ path: "/entries/p1/publish", body: undefined }]),
      );
    });
  });
});
