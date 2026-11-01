import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MediaLibraryPage } from "./MediaLibraryPage.js";
import { makeAsset, mockApi, renderWithQueries } from "./media.test-helpers.js";

afterEach(() => vi.restoreAllMocks());

const beach = makeAsset({ id: "bbbbbbbb-0000-4000-8000-000000000001", filename: "beach.jpg" });
const menu = makeAsset({
  id: "bbbbbbbb-0000-4000-8000-000000000002",
  filename: "menu.pdf",
  mimeType: "application/pdf",
  width: null,
  height: null,
  thumbnailUrl: null,
});

describe("MediaLibraryPage", () => {
  it("sends the search and the filter to the API", async () => {
    const requested = mockApi((path) => {
      const query = new URLSearchParams(path.split("?")[1]);
      if (query.get("type") === "image") return { assets: [beach], total: 1 };
      return { assets: [beach, menu], total: 2 };
    });
    renderWithQueries(<MediaLibraryPage permissions={["*"]} />);

    expect(await screen.findByRole("button", { name: /menu\.pdf/ })).toBeInTheDocument();
    expect(screen.getByText("2 files")).toBeInTheDocument();
    expect(requested).toEqual(["/media?page=1&perPage=60"]);

    await userEvent.type(screen.getByRole("searchbox", { name: "Search" }), "  beach ");
    await waitFor(() => expect(requested).toContain("/media?page=1&perPage=60&search=beach"));

    await userEvent.click(screen.getByRole("radio", { name: "Images" }));
    await waitFor(() =>
      expect(requested).toContain("/media?page=1&perPage=60&search=beach&type=image"),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /menu\.pdf/ })).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("radio", { name: "Documents" }));
    await waitFor(() =>
      expect(requested).toContain("/media?page=1&perPage=60&search=beach&type=document"),
    );
  });

  it("guides people when the library is empty, and hides upload without permission", async () => {
    mockApi(() => ({ assets: [], total: 0 }));
    const { unmount } = renderWithQueries(<MediaLibraryPage permissions={["*"]} />);

    expect(await screen.findByText("Your media library is empty")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload files" })).toBeInTheDocument();
    unmount();

    renderWithQueries(<MediaLibraryPage permissions={["media:read"]} />);
    expect(await screen.findByText("Your media library is empty")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /upload/i })).not.toBeInTheDocument();
  });

  it("says when a search finds nothing", async () => {
    mockApi((path) =>
      path.includes("search=") ? { assets: [], total: 0 } : { assets: [beach], total: 1 },
    );
    renderWithQueries(<MediaLibraryPage permissions={["*"]} />);
    await screen.findByRole("button", { name: /beach\.jpg/ });

    await userEvent.type(screen.getByRole("searchbox", { name: "Search" }), "zebra");

    expect(
      await screen.findByText("Nothing matches “zebra”. Try another word, or show all files."),
    ).toBeInTheDocument();
  });

  it("opens a file's details, and lists where it is used when deleting is refused", async () => {
    mockApi((path, init) => {
      if (init?.method === "DELETE") {
        return new Response(
          JSON.stringify({
            statusCode: 409,
            code: "ASSET_IN_USE",
            error: "Conflict",
            message: "This file is used in 2 entries.",
            usedBy: [
              { entryId: "e1", title: "Home" },
              { entryId: "e2", title: "About us" },
            ],
          }),
          { status: 409 },
        );
      }
      return { assets: [beach], total: 1 };
    });
    renderWithQueries(<MediaLibraryPage permissions={["*"]} />);

    await userEvent.click(await screen.findByRole("button", { name: /beach\.jpg/ }));
    const sheet = screen.getByRole("dialog", { name: "beach.jpg" });
    expect(within(sheet).getByLabelText("Alt text")).toHaveAccessibleDescription(
      /Describe the image for people who can’t see it/,
    );
    await userEvent.click(within(sheet).getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("alertdialog", { name: "Delete “beach.jpg”?" });
    await userEvent.click(within(confirm).getByRole("button", { name: "Delete file" }));

    const inUse = await screen.findByRole("alertdialog", { name: "This file is still in use" });
    expect(within(inUse).getByText("Home")).toBeInTheDocument();
    expect(within(inUse).getByText("About us")).toBeInTheDocument();
    expect(within(inUse).queryByRole("button", { name: "Delete file" })).not.toBeInTheDocument();
  });

  it("saves a focal point moved just before the details are closed", async () => {
    const patches: unknown[] = [];
    mockApi((path, init) => {
      if (init?.method === "PATCH") {
        patches.push(JSON.parse(String(init.body)));
        return beach;
      }
      return { assets: [beach], total: 1 };
    });
    renderWithQueries(<MediaLibraryPage permissions={["*"]} />);

    await userEvent.click(await screen.findByRole("button", { name: /beach\.jpg/ }));
    const sheet = screen.getByRole("dialog", { name: "beach.jpg" });
    within(sheet).getByRole("application", { name: "Focal point" }).focus();
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }));

    await waitFor(() => expect(patches).toEqual([{ focalPoint: { x: 0.6, y: 0.5 } }]));
  });
});
