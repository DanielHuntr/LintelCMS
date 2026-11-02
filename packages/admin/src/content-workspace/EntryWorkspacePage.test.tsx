import { useRouterState } from "@tanstack/react-router";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { postBlueprint, postsCollection, samplePost } from "../content/testEntries.js";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { EntryWorkspacePage } from "./EntryWorkspacePage.js";

afterEach(() => vi.restoreAllMocks());

/** The page as the route draws it: the entry id comes from the address. */
function EntryAtAddress() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const entryId = pathname.split("/").at(-1) ?? "new";
  return (
    <EntryWorkspacePage
      collectionHandle="posts"
      entryId={entryId}
      tab={undefined}
      isPreviewOpen={false}
      onTabChange={vi.fn()}
      onPreviewChange={vi.fn()}
    />
  );
}

describe("an entry's page", () => {
  // The first save of a new entry used to swap the editor for the workspace, so the cursor
  // left the field and words typed while it saved were lost.
  it("keeps the editor, and what is being typed, when a new entry is first saved", async () => {
    const api = mockApi(({ method, url, body }) => {
      const path = url.pathname;
      if (path === "/collections/posts") return postsCollection;
      if (path.startsWith("/blueprints/")) return postBlueprint;
      if (method === "POST" && path === "/collections/posts/entries") {
        const sent = body as { data: { title: string } };
        return samplePost({ id: "p9", title: sent.data.title, data: { ...sent.data } });
      }
      if (method === "PATCH") return samplePost({ id: "p9" });
      if (path.endsWith("/revisions")) return { revisions: [] };
      throw new Error(`Unexpected ${method} ${path}`);
    });
    const { router } = renderScreen(<EntryAtAddress />, { initialPath: "/content/posts/new" });

    const title = await screen.findByRole("textbox", { name: "Title" });
    await userEvent.type(title, "Hello");
    await waitFor(() => expect(router.state.location.pathname).toBe("/content/posts/p9"), {
      timeout: 5000,
    });
    await userEvent.type(title, " world");

    expect(screen.getByRole("textbox", { name: "Title" })).toBe(title);
    expect(title).toHaveFocus();
    expect(title).toHaveValue("Hello world");
    expect(api.calls.filter((call) => call.method === "POST")).toHaveLength(1);
  }, 10_000);
});
