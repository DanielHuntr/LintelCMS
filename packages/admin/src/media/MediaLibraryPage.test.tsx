import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../design/Toast.js";
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

  it("shows only the pictures that need a description, from the dashboard's link", async () => {
    const requested = mockApi(() => ({ assets: [beach], total: 1 }));
    renderWithQueries(<MediaLibraryPage permissions={["*"]} initialFilter="needsDescription" />);

    expect(await screen.findByRole("button", { name: /beach/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "No description" })).toBeChecked();
    expect(requested).toEqual(["/media?page=1&perPage=60&missingAlt=true"]);
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
    expect(within(sheet).getByLabelText("Picture description")).toHaveAccessibleDescription(
      /For people who can’t see it/,
    );
    await userEvent.click(within(sheet).getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("alertdialog", { name: "Delete “beach.jpg”?" });
    await userEvent.click(within(confirm).getByRole("button", { name: "Move to recycle bin" }));

    const inUse = await screen.findByRole("alertdialog", { name: "This file is still in use" });
    expect(within(inUse).getByText("Home")).toBeInTheDocument();
    expect(within(inUse).getByText("About us")).toBeInTheDocument();
    expect(
      within(inUse).queryByRole("button", { name: "Move to recycle bin" }),
    ).not.toBeInTheDocument();
  });

  it("names the site font a downloaded font file belongs to when deleting is refused", async () => {
    mockApi((path, init) => {
      if (init?.method === "DELETE") {
        return new Response(
          JSON.stringify({
            statusCode: 409,
            code: "ASSET_IN_USE",
            error: "Conflict",
            message: "This file is used in 1 place.",
            usedBy: [{ entryId: "f1", title: "Playfair Display", place: "siteFonts" }],
          }),
          { status: 409 },
        );
      }
      return { assets: [beach], total: 1 };
    });
    renderWithQueries(<MediaLibraryPage permissions={["*"]} />);

    await userEvent.click(await screen.findByRole("button", { name: /beach\.jpg/ }));
    const sheet = screen.getByRole("dialog", { name: "beach.jpg" });
    await userEvent.click(within(sheet).getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("alertdialog", { name: "Delete “beach.jpg”?" });
    await userEvent.click(within(confirm).getByRole("button", { name: "Move to recycle bin" }));

    const inUse = await screen.findByRole("alertdialog", { name: "This file is still in use" });
    expect(within(inUse).getByText("Site fonts → Playfair Display")).toBeInTheDocument();
    expect(inUse).toHaveAccessibleDescription(/A font your site uses is made from this file/);
    expect(
      within(inUse).queryByRole("button", { name: "Move to recycle bin" }),
    ).not.toBeInTheDocument();
  });

  it("names the site whose cursor shows a picture when deleting is refused", async () => {
    mockApi((path, init) => {
      if (init?.method === "DELETE") {
        return new Response(
          JSON.stringify({
            statusCode: 409,
            code: "ASSET_IN_USE",
            error: "Conflict",
            message: "This file is used in 1 place.",
            usedBy: [{ entryId: "s1", title: "Bakery", place: "siteCursor" }],
          }),
          { status: 409 },
        );
      }
      return { assets: [beach], total: 1 };
    });
    renderWithQueries(<MediaLibraryPage permissions={["*"]} />);

    await userEvent.click(await screen.findByRole("button", { name: /beach\.jpg/ }));
    const sheet = screen.getByRole("dialog", { name: "beach.jpg" });
    await userEvent.click(within(sheet).getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("alertdialog", { name: "Delete “beach.jpg”?" });
    await userEvent.click(within(confirm).getByRole("button", { name: "Move to recycle bin" }));

    const inUse = await screen.findByRole("alertdialog", { name: "This file is still in use" });
    expect(within(inUse).getByText("Site cursor → Bakery")).toBeInTheDocument();
    expect(inUse).toHaveAccessibleDescription(/Your site’s cursor shows this picture/);
  });

  it("moves a file to the recycle bin and brings it back with Undo", async () => {
    let isBinned = false;
    const requested = mockApi((path, init) => {
      if (init?.method === "DELETE") {
        isBinned = true;
        return new Response(null, { status: 204 });
      }
      if (init?.method === "POST" && path === `/media-bin/${beach.id}/restore`) {
        isBinned = false;
        return beach;
      }
      return isBinned ? { assets: [], total: 0 } : { assets: [beach], total: 1 };
    });
    renderWithQueries(
      <ToastProvider>
        <MediaLibraryPage permissions={["*"]} />
      </ToastProvider>,
    );

    await userEvent.click(await screen.findByRole("button", { name: /beach\.jpg/ }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }),
    );
    const confirm = screen.getByRole("alertdialog", { name: "Delete “beach.jpg”?" });
    expect(confirm).toHaveAccessibleDescription(/goes to the recycle bin/);
    await userEvent.click(within(confirm).getByRole("button", { name: "Move to recycle bin" }));

    await screen.findByText("Moved “beach.jpg” to the recycle bin.");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /beach\.jpg/ })).not.toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    await screen.findByText("Brought “beach.jpg” back.");
    expect(requested).toContain(`/media-bin/${beach.id}/restore`);
    expect(await screen.findByRole("button", { name: /beach\.jpg/ })).toBeInTheDocument();
  });

  it("opens the file chooser straight away when the command palette asks", async () => {
    mockApi(() => ({ assets: [beach], total: 1 }));
    const chosen = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    const onUploadStarted = vi.fn();
    renderWithQueries(
      <MediaLibraryPage permissions={["*"]} startUpload onUploadStarted={onUploadStarted} />,
    );

    await waitFor(() => expect(onUploadStarted).toHaveBeenCalledOnce());
    expect(chosen).toHaveBeenCalledOnce();
  });
});
