import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiErrorResponse, mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { EntryEditor } from "./EntryEditor.js";
import { postBlueprint, postsCollection, samplePost } from "./testEntries.js";

/** Renders the editor for a saved draft and waits for the router to show it. */
async function renderEditor(permissions?: string[]) {
  renderScreen(
    <EntryEditor
      collection={postsCollection}
      blueprint={postBlueprint}
      initialEntry={samplePost()}
      onCreated={() => undefined}
    />,
    { permissions },
  );
  await screen.findByRole("textbox", { name: "Title" });
}

afterEach(() => vi.restoreAllMocks());

describe("EntryEditor", () => {
  it("shows the API's message under each field it rejected and focuses the first", async () => {
    mockApi(({ method, url }) => {
      if (method === "PATCH") {
        throw apiErrorResponse(400, "INVALID_REQUEST", "Some fields need attention.", {
          category: "Choose a category.",
          excerpt: "Add an excerpt.",
        });
      }
      if (url.pathname.endsWith("/revisions")) return { revisions: [] };
      throw new Error(`Unexpected ${method} ${url.pathname}`);
    });
    await renderEditor();

    await userEvent.type(screen.getByRole("textbox", { name: "Title" }), "!");
    await userEvent.keyboard("{Control>}s{/Control}");

    const excerpt = await screen.findByRole("textbox", { name: "Excerpt Required" });
    await waitFor(() => expect(excerpt).toHaveFocus());
    expect(excerpt).toHaveAccessibleDescription("Add an excerpt.");
    expect(screen.getByRole("combobox", { name: "Category Required" })).toHaveAccessibleDescription(
      "Choose a category.",
    );
    expect(screen.getByText("Couldn’t save", { selector: "[role=status]" })).toBeInTheDocument();
  });

  it("offers Publish to people who may publish", async () => {
    mockApi(() => ({ revisions: [] }));
    await renderEditor(["*"]);

    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Schedule/ })).toBeInTheDocument();
  });

  it("hides Publish and Schedule from people who can't publish, offering Save instead", async () => {
    mockApi(() => ({ revisions: [] }));
    await renderEditor(["entries:read", "entries:update"]);

    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Schedule/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "You can save drafts. Someone with permission to publish can make them live.",
      ),
    ).toBeInTheDocument();
  });

  it("saves, then publishes, when Publish is pressed with unsaved changes", async () => {
    const api = mockApi(({ method, url }) => {
      if (method === "PATCH") return samplePost({ data: { title: "Hello world!" } });
      if (url.pathname.endsWith("/publish")) return samplePost({ status: "published" });
      return { revisions: [] };
    });
    await renderEditor();

    await userEvent.type(screen.getByRole("textbox", { name: "Title" }), "!");
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));

    await screen.findByRole("button", { name: "Published" });
    const writes = api.calls
      .filter(({ method }) => method !== "GET")
      .map(({ method, url }) => `${method} ${url.pathname}`);
    expect(writes).toEqual(["PATCH /entries/p1", "POST /entries/p1/publish"]);
  });

  it("keeps the draft saved and points at required fields when publishing is refused", async () => {
    mockApi(({ method, url }) => {
      if (method === "PATCH") return samplePost({ data: { title: "Hello world!" } });
      if (url.pathname.endsWith("/publish")) {
        throw apiErrorResponse(
          400,
          "NOT_READY_TO_PUBLISH",
          "Fill in the required fields to publish.",
          { excerpt: "Excerpt is required" },
        );
      }
      return { revisions: [] };
    });
    await renderEditor();

    await userEvent.type(screen.getByRole("textbox", { name: "Title" }), "!");
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));

    const excerpt = await screen.findByRole("textbox", { name: "Excerpt Required" });
    await waitFor(() => expect(excerpt).toHaveFocus());
    expect(excerpt).toHaveAccessibleDescription("Excerpt is required");
    expect(
      screen.getByText(
        "Fill in the required fields to publish. Your changes are saved as a draft.",
      ),
    ).toBeInTheDocument();
  });

  it("offers View page for a published entry: the website, or Lintel's simple preview", async () => {
    let siteAddress: string | null = "https://brightsidebakery.com";
    mockApi(({ url }) =>
      url.pathname === "/website/address"
        ? { siteAddress, defaultLocale: "en-GB" }
        : { revisions: [] },
    );
    const published = samplePost({ status: "published", publishedAt: "2026-10-01T09:00:00.000Z" });
    const editor = () =>
      renderScreen(
        <EntryEditor
          collection={postsCollection}
          blueprint={postBlueprint}
          initialEntry={published}
          onCreated={() => undefined}
        />,
      );

    editor();
    // One in the toolbar, one at the end of the address under the title.
    const toWebsite = await screen.findAllByRole("link", { name: "View page" });
    expect(toWebsite).toHaveLength(2);
    for (const link of toWebsite) {
      expect(link).toHaveAttribute("href", "https://brightsidebakery.com/blog/hello-world");
      expect(link).toHaveAttribute("target", "_blank");
    }
    cleanup();

    siteAddress = null;
    editor();
    const [toPreview] = await screen.findAllByRole("link", { name: "View page" });
    expect(toPreview).toHaveAttribute("href", "/content/posts/p1/view");
  });

  it("has no View page while the entry is a draft", async () => {
    mockApi(() => ({ revisions: [] }));
    await renderEditor();
    expect(screen.queryByRole("link", { name: "View page" })).not.toBeInTheDocument();
  });

  it("duplicates from the More menu and opens the copy", async () => {
    const api = mockApi(({ method, url }) => {
      if (method === "POST" && url.pathname === "/entries/p1/duplicate") {
        return samplePost({ id: "p2", title: "Hello world (copy)", slug: "hello-world-copy" });
      }
      if (url.pathname === "/collections") return { collections: [] };
      return { revisions: [] };
    });
    const { router } = renderScreen(
      <EntryEditor
        collection={postsCollection}
        blueprint={postBlueprint}
        initialEntry={samplePost()}
        onCreated={() => undefined}
      />,
    );
    await screen.findByRole("textbox", { name: "Title" });

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Duplicate entry" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/content/posts/p2"));
    expect(api.calls.some(({ url }) => url.pathname === "/entries/p1/duplicate")).toBe(true);
  });

  it("leaves Duplicate out for people who can't create entries", async () => {
    mockApi(() => ({ revisions: [] }));
    await renderEditor(["entries:read", "entries:update"]);

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));

    expect(screen.getByRole("menuitem", { name: "Preview" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Duplicate entry" })).not.toBeInTheDocument();
  });

  it("opens the preview beside the document in place of the side panel", async () => {
    mockApi(({ method, url }) => {
      if (method === "POST" && url.pathname === "/entries/p1/preview") {
        return { token: "t.k", expiresAt: "2026-11-01T10:00:00Z", previewUrl: null };
      }
      if (url.pathname === "/preview") {
        return {
          collection: "posts",
          entry: {
            id: "p1",
            slug: "hello-world",
            url: null,
            publishedAt: null,
            data: { title: "Hello world" },
          },
        };
      }
      return { revisions: [] };
    });
    await renderEditor();
    const previewButton = screen.getByRole("button", { name: "Preview" });

    await userEvent.click(previewButton);

    expect(previewButton).toHaveAttribute("aria-expanded", "true");
    const pane = screen.getByRole("complementary", { name: "Preview" });
    expect(
      await within(pane).findByRole("heading", { level: 1, name: "Hello world" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Blog posts" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close preview" }));
    expect(screen.getByRole("complementary", { name: "Blog posts" })).toBeInTheDocument();
  });
});
