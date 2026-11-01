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
};

function answerWorkspace() {
  return mockApi(({ method, url }) => {
    const path = url.pathname;
    if (path.endsWith("/info")) return info;
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

  it("asks before opening another node with unsaved changes", async () => {
    answerWorkspace();
    const { router } = renderWorkspace();

    await userEvent.type(await screen.findByRole("textbox", { name: "Title" }), "!");
    void router.navigate({ to: "/content/posts/p2" });

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
    await userEvent.click(within(bar).getByRole("button", { name: "More publishing options" }));
    expect(screen.getByRole("menuitem", { name: "Schedule…" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Unpublish" })).toBeTruthy();
  });
});
