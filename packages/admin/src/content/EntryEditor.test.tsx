import { screen, waitFor } from "@testing-library/react";
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
});
