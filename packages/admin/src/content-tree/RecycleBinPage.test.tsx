import { screen, waitFor, within } from "@testing-library/react";
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

  it("lists deleted files under Files and restores one to the media library", async () => {
    const api = mockApi(({ method, url }) => {
      if (url.pathname === "/recycle-bin") return { items: [] };
      if (method === "GET" && url.pathname === "/media-bin") {
        return {
          items: [
            {
              id: "f1",
              filename: "logo.png",
              mimeType: "image/png",
              size: 2048,
              deletedAt: "2026-11-01T09:00:00.000Z",
              deletedBy: { id: "u1", name: "Ana" },
            },
          ],
        };
      }
      if (method === "POST" && url.pathname === "/media-bin/f1/restore") return { id: "f1" };
      return {};
    });
    renderScreen(
      <WithTestTree>
        <RecycleBinPage />
      </WithTestTree>,
      { initialPath: "/content/recycle-bin" },
    );

    const files = await screen.findByRole("list", { name: "Files" });
    expect(within(files).getByText("logo.png")).toBeInTheDocument();
    expect(within(files).getByText(/by Ana · 2 kB/)).toBeInTheDocument();
    await userEvent.click(within(files).getByRole("button", { name: "Restore logo.png" }));

    expect(
      await screen.findByText("Restored “logo.png” to the media library."),
    ).toBeInTheDocument();
    expect(api.calls.some((call) => call.url.pathname === "/media-bin/f1/restore")).toBe(true);
  });
});

describe("the recycle bin (QA sweep)", () => {
  it("tells two items called Home apart by where they were and what was under them", async () => {
    const home = (id: string, address: string, childTitles: string[], itemCount: number) => ({
      id,
      entryId: `e-${id}`,
      title: "Home",
      collection: { handle: "pages", name: "Pages" },
      itemCount,
      deletedAt: "2026-11-01T09:00:00.000Z",
      deletedBy: null,
      address,
      childTitles,
    });
    mockApi(({ url }) =>
      url.pathname === "/recycle-bin"
        ? {
            items: [
              home("r1", "/", ["About", "Menu", "Contact"], 6),
              home("r2", "/shop", ["Cakes"], 2),
            ],
          }
        : {},
    );
    renderScreen(
      <WithTestTree actions={[]}>
        <RecycleBinPage />
      </WithTestTree>,
      { initialPath: "/content/recycle-bin" },
    );

    expect(
      await screen.findByText("Was at / · Under it: About, Menu, Contact and 2 more"),
    ).toBeTruthy();
    expect(screen.getByText("Was at /shop · Under it: Cakes")).toBeTruthy();
  });
});
