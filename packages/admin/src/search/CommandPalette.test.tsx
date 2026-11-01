import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { postsCollection } from "../content/testEntries.js";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { CommandPalette } from "./CommandPalette.js";
import { useCommandPalette } from "./useCommandPalette.js";

function PaletteWithShortcut() {
  const palette = useCommandPalette();
  return <CommandPalette open={palette.isOpen} onClose={palette.close} />;
}

function answerSearches() {
  return mockApi(({ url }) => {
    if (url.pathname === "/collections") return { collections: [postsCollection] };
    if (url.pathname === "/search") {
      return {
        query: url.searchParams.get("q"),
        entries: [
          {
            id: "p1",
            title: "Hello world",
            slug: "hello-world",
            status: "published",
            collection: { handle: "posts", name: "Blog posts" },
            updatedAt: "2026-10-01T09:00:00Z",
          },
        ],
        assets: [],
      };
    }
    throw new Error(`Unexpected request to ${url.pathname}`);
  });
}

afterEach(() => vi.restoreAllMocks());

describe("the command palette", () => {
  it("opens with Ctrl+K and finds content as you type", async () => {
    const api = answerSearches();
    renderScreen(<PaletteWithShortcut />);

    await userEvent.keyboard("{Control>}k{/Control}");
    const input = await screen.findByRole("combobox", { name: "Search Lintel" });
    expect(input).toHaveFocus();
    await userEvent.type(input, "hello");

    const option = await screen.findByRole("option", {
      name: /Hello world, Blog posts · Published/,
    });
    expect(option).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", option.id);
    const searches = api.calls.filter(({ url }) => url.pathname === "/search");
    expect(searches.at(-1)?.url.searchParams.get("q")).toBe("hello");
  });

  it("moves through the results with the arrow keys and opens one with Enter", async () => {
    answerSearches();
    const { router } = renderScreen(<PaletteWithShortcut />);

    await userEvent.keyboard("{Control>}k{/Control}");
    const input = await screen.findByRole("combobox", { name: "Search Lintel" });
    // "Blog" matches the Blog posts collection right away, and the API's entry after.
    await userEvent.type(input, "blog");
    await screen.findByRole("option", { name: /Hello world/ });
    expect(screen.getByRole("option", { name: /Blog posts, All Blog posts/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await userEvent.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => expect(router.state.location.pathname).toBe("/content/posts/p1"));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("says when nothing matches", async () => {
    mockApi(({ url }) =>
      url.pathname === "/search" ? { query: "zzz", entries: [], assets: [] } : { collections: [] },
    );
    renderScreen(<PaletteWithShortcut />);

    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.type(await screen.findByRole("combobox"), "zzz");

    expect(await screen.findByText("Nothing matches “zzz”.")).toBeInTheDocument();
  });
});
