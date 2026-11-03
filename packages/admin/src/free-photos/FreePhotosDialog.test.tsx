import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeAsset } from "../media/media.test-helpers.js";
import { MediaLibraryPage } from "../media/MediaLibraryPage.js";
import { apiErrorResponse, mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { FreePhoto } from "./freePhotos.api.js";
import { FreePhotosDialog } from "./FreePhotosDialog.js";

const bakery: FreePhoto = {
  id: "a41bba82-76b0-4ddf-93ea-c907b0b191f7",
  title: "Bakery",
  creator: "InfoMofo",
  creatorUrl: "https://www.flickr.com/photos/example",
  licence: "by-sa",
  licenceName: "CC BY-SA 2.0",
  licenceUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
  pageUrl: "https://www.flickr.com/photos/example/141332285",
  source: "flickr",
  width: 1024,
  height: 768,
  thumbnailUrl: "http://localhost:4000/free-photos/a41bba82-76b0-4ddf-93ea-c907b0b191f7/thumbnail",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FreePhotosDialog", () => {
  it("waits for a search before asking anything, then shows each photo's creator and licence", async () => {
    const api = mockApi(({ url }) => {
      if (url.pathname === "/free-photos/search")
        return { photos: [bakery], page: 1, pageCount: 1 };
      return {};
    });
    renderScreen(
      <FreePhotosDialog mode="add" onAdded={() => undefined} onClose={() => undefined} />,
      { enabledPlugins: ["free-photos"] },
    );

    expect(await screen.findByText("Find a photo")).toBeInTheDocument();
    expect(api.calls).toHaveLength(0);

    await userEvent.type(await screen.findByLabelText("Search free photos"), "bread shop");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    const results = await screen.findByRole("list", { name: "Free photos for “bread shop”" });
    expect(within(results).getByText("Bakery")).toBeInTheDocument();
    expect(within(results).getByText("by InfoMofo")).toBeInTheDocument();
    expect(within(results).getByText("CC BY-SA 2.0")).toBeInTheDocument();
    expect(within(results).getByRole("link", { name: "Source of “Bakery”" })).toHaveAttribute(
      "href",
      bakery.pageUrl,
    );
    expect(api.calls[0]?.url.searchParams.get("q")).toBe("bread shop");
    expect(screen.getByText(/CC0, Public Domain Mark, CC BY and CC BY-SA/)).toBeInTheDocument();
  });

  it("adds a photo to the media library and says so", async () => {
    const added = makeAsset({ filename: "Bakery.jpg", credit: "“Bakery” by InfoMofo" });
    const api = mockApi(({ url, method }) => {
      if (url.pathname === "/free-photos/search")
        return { photos: [bakery], page: 1, pageCount: 1 };
      if (method === "POST" && url.pathname === "/free-photos/add") return added;
      return {};
    });
    const onAdded = vi.fn();
    renderScreen(<FreePhotosDialog mode="add" onAdded={onAdded} onClose={() => undefined} />);

    await userEvent.type(await screen.findByLabelText("Search free photos"), "bread{Enter}");
    await userEvent.click(
      await screen.findByRole("button", { name: "Add “Bakery” to your media" }),
    );

    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(added));
    expect(screen.getByText("Added")).toBeInTheDocument();
    const post = api.calls.find((call) => call.method === "POST");
    expect(post?.body).toEqual({ id: bakery.id });
  });

  it("leaves out photos whose files have gone, which couldn't be seen or added", async () => {
    const gone = { ...bakery, id: "b1111111-1111-4111-8111-111111111111", title: "Gone" };
    mockApi(({ url }) => {
      if (url.pathname === "/free-photos/search") {
        return { photos: [bakery, gone], page: 1, pageCount: 1 };
      }
      if (url.pathname.includes(gone.id)) {
        throw apiErrorResponse(404, "FREE_PHOTO_NOT_FOUND", "That photo is no longer available.");
      }
      return {};
    });
    renderScreen(
      <FreePhotosDialog mode="add" onAdded={() => undefined} onClose={() => undefined} />,
    );

    await userEvent.type(await screen.findByLabelText("Search free photos"), "bread{Enter}");

    expect(await screen.findByText("Bakery")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Gone")).not.toBeInTheDocument());
  });

  it("explains a failed search in plain words, with a way to try again", async () => {
    mockApi(() => {
      throw apiErrorResponse(
        502,
        "FREE_PHOTOS_UNAVAILABLE",
        "The free photo search isn't answering right now. Try again in a minute.",
      );
    });
    renderScreen(
      <FreePhotosDialog mode="add" onAdded={() => undefined} onClose={() => undefined} />,
    );

    await userEvent.type(await screen.findByLabelText("Search free photos"), "bread{Enter}");

    expect(await screen.findByText("The search didn’t work")).toBeInTheDocument();
    expect(screen.getByText(/isn't answering right now/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("free photos in the media library", () => {
  function library() {
    mockApi(({ url }) =>
      url.pathname === "/media" ? { assets: [makeAsset()], total: 1 } : { sites: [] },
    );
  }

  it("are offered only while the plugin is switched on", async () => {
    library();
    renderScreen(<MediaLibraryPage permissions={["*"]} />, { enabledPlugins: ["free-photos"] });

    await userEvent.click(await screen.findByRole("button", { name: "Free photos" }));
    expect(await screen.findByRole("dialog", { name: "Free photos" })).toBeInTheDocument();
  });

  it("are not offered while it is off", async () => {
    library();
    renderScreen(<MediaLibraryPage permissions={["*"]} />, { enabledPlugins: [] });

    await screen.findByRole("button", { name: "Upload" });
    expect(screen.queryByRole("button", { name: "Free photos" })).not.toBeInTheDocument();
  });
});
