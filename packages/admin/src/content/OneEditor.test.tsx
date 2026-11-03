import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EntryEditor } from "./EntryEditor.js";
import { postBlueprint, postsCollection, samplePost } from "./testEntries.js";
import type { Entry } from "./content.types.js";
import { WithTestTree } from "../content-tree/testTree.js";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";

// Creating an entry and opening one from the tree used to show two different editors: the
// old one with a side panel for new entries, a tabbed workspace with a bar along the bottom
// for saved ones. There is one editor now, so these are the workspace's behaviours, kept.

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

function answer(infoChanges: Partial<typeof info> = {}) {
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
    if (path.endsWith("/translations")) return { translations: [] };
    if (method === "PATCH")
      return samplePost({ data: { title: "Hello there", excerpt: "", category: null } });
    if (method === "POST" && path === "/content-tree/bulk") return { changed: ["h1"], skipped: [] };
    if (method === "POST" && path.endsWith("/publish")) return samplePost({ status: "published" });
    return [];
  });
}

function renderEditor(entry: Entry | "new" = samplePost()) {
  return renderScreen(
    <WithTestTree>
      <EntryEditor
        collection={postsCollection}
        blueprint={postBlueprint}
        initialEntry={entry === "new" ? undefined : entry}
        onCreated={() => undefined}
      />
    </WithTestTree>,
    { initialPath: "/content/posts/p1" },
  );
}

describe("one editor for new and saved entries", () => {
  it("shows where the entry is, its name to edit, and its address", async () => {
    answer();
    renderEditor();

    const breadcrumbs = await screen.findByRole("navigation", { name: "Where it is" });
    expect(within(breadcrumbs).getByRole("link", { name: "Blog posts" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveProperty("value", "Hello world");
  });

  it("is the same editor for a new entry, with Publish only once it has a title", async () => {
    answer();
    renderEditor("new");

    expect(await screen.findByRole("navigation", { name: "Where it is" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox", { name: "Title" }), "About us");
    expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled();
  });

  it("shows the details: address, who made it, its id", async () => {
    answer();
    renderEditor();

    await userEvent.click(await screen.findByRole("button", { name: "More actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Details" }));

    const details = await screen.findByRole("dialog", { name: "Details" });
    expect(await within(details).findByText("/blog/hello-world")).toBeTruthy();
    expect(within(details).getByText(/by Ada Lovelace/)).toBeTruthy();
    expect(within(details).getByText("p1")).toBeTruthy();
  });

  it("shows the home page's address itself, not a slug it doesn't use", async () => {
    answer({
      url: "/",
      urls: ["/"],
      siteStart: { isDefault: true, isAssigned: false, hostname: "", pathPrefix: "" },
    });
    renderEditor();

    await screen.findByRole("navigation", { name: "Where it is" });
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "URL:" })).toBeNull());
  });

  // The workspace showed a pale "Published" that looked disabled when there was nothing new.
  it("says a live page with nothing new is live, in words, instead of a greyed-out button", async () => {
    answer();
    renderEditor(samplePost({ status: "published", publishedAt: "2026-10-01T10:00:00.000Z" }));

    expect(await screen.findByText("Live on your site")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Published" })).toBeNull();
  });

  it("asks before opening another entry with unsaved changes", async () => {
    answer();
    const { router } = renderEditor();

    await userEvent.type(await screen.findByRole("textbox", { name: "Title" }), "!");
    void router.navigate({
      to: "/content/$collection/$entryId",
      params: { collection: "posts", entryId: "p2" },
    });

    const dialog = await screen.findByRole("alertdialog", { name: "Leave without saving?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(router.state.location.pathname).toBe("/content/posts/p1");
  });

  // LINTEL-FUNC-024: opening the preview (which goes in the address) asked "Leave without
  // saving?", though nothing was being left.
  it("doesn't ask before showing the preview or the items, which stay on the same page", async () => {
    answer();
    const { router } = renderEditor();

    await userEvent.type(await screen.findByRole("textbox", { name: "Title" }), "!");
    await router.navigate({
      to: "/content/$collection/$entryId",
      params: { collection: "posts", entryId: "p1" },
      search: { preview: true },
    });

    expect(router.state.location.search).toMatchObject({ preview: true });
    expect(screen.queryByRole("alertdialog", { name: "Leave without saving?" })).toBeNull();
  });

  // Saving used to send the parent the editor opened with, so a page moved in the tree
  // meanwhile was quietly moved back on the next autosave.
  it("saves only what changed here: not where the page sits, nor fields left alone", async () => {
    const api = answer();
    renderEditor();

    await userEvent.type(await screen.findByRole("textbox", { name: "Title" }), "!");
    await userEvent.keyboard("{Control>}s{/Control}");

    await waitFor(() => expect(api.calls.some((call) => call.method === "PATCH")).toBe(true));
    const saved = api.calls.find((call) => call.method === "PATCH")?.body as {
      data: Record<string, unknown>;
    };
    expect(saved).toMatchObject({ data: { title: "Hello world!" } });
    expect(Object.keys(saved.data)).toEqual(["title"]);
    expect(saved).not.toHaveProperty("parentId");
    expect(saved).not.toHaveProperty("slug");
  });

  describe("publishing a page whose parent isn't published", () => {
    const posts = (api: ReturnType<typeof answer>) =>
      api.calls
        .filter((call) => call.method === "POST")
        .map((call) => ({ path: call.url.pathname, body: call.body }));

    async function pressPublish() {
      // The question needs the page's info, which loads beside the editor.
      await waitFor(() => expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled());
      await new Promise((resolve) => setTimeout(resolve, 50));
      await userEvent.click(screen.getByRole("button", { name: "Publish" }));
      return screen.findByRole("alertdialog", { name: "Its parent page isn’t published" });
    }

    it("explains, and publishes the parent first when asked", async () => {
      const api = answer({ unpublishedAncestors: [{ id: "h1", title: "Home" }] });
      renderEditor();
      await screen.findByRole("navigation", { name: "Where it is" });

      const question = await pressPublish();
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
      const api = answer({ unpublishedAncestors: [{ id: "h1", title: "Home" }] });
      renderEditor();
      await screen.findByRole("navigation", { name: "Where it is" });

      const question = await pressPublish();
      await userEvent.click(
        within(question).getByRole("button", { name: "Publish this page only" }),
      );

      await waitFor(() =>
        expect(posts(api)).toEqual([{ path: "/entries/p1/publish", body: undefined }]),
      );
    });
  });
});
