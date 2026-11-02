import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { RecycleBinPage } from "./RecycleBinPage.js";
import { WithTestTree } from "./testTree.js";

afterEach(() => vi.restoreAllMocks());

describe("the recycle bin", () => {
  // Restoring opened the page, so the bin's "Restored" note was never seen, and the
  // "moved to the recycle bin" note stayed at the foot of the tree.
  it("says Restored at the foot of the tree, in place of the deleted note", async () => {
    const actions: unknown[] = [];
    mockApi(({ method, url }) => {
      if (method === "GET" && url.pathname === "/recycle-bin") {
        return {
          items: [
            {
              id: "r1",
              entryId: "e1",
              title: "About",
              collection: { handle: "pages", name: "Pages" },
              itemCount: 1,
              deletedAt: "2026-11-01T09:00:00.000Z",
              deletedBy: null,
            },
          ],
        };
      }
      if (method === "POST" && url.pathname === "/recycle-bin/r1/restore") {
        return { entryId: "e1", parentId: null, restoredCount: 1 };
      }
      return {};
    });
    const { router } = renderScreen(
      <WithTestTree actions={actions}>
        <RecycleBinPage />
      </WithTestTree>,
      { initialPath: "/content/recycle-bin" },
    );

    await userEvent.click(await screen.findByRole("button", { name: "Restore About" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/content/pages/e1"));
    expect(actions).toContainEqual({
      notice: { tone: "neutral", message: "Restored “About” as a draft." },
    });
  });
});
