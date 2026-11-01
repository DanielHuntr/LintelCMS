import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { EntriesListPage } from "./EntriesListPage.js";
import { entriesListPath, type EntriesFilter } from "./entriesQuery.js";
import { postsCollection, samplePost } from "./testEntries.js";

/** The page with its filter kept in state, as the router keeps it in the URL. */
function EntriesListWithFilter() {
  const [filter, setFilter] = useState<EntriesFilter>({});
  return <EntriesListPage collectionHandle="posts" filter={filter} onFilterChange={setFilter} />;
}

function answerLikeTheApi() {
  return mockApi(({ url }) => {
    if (url.pathname === "/collections/posts") return postsCollection;
    if (url.pathname === "/collections/posts/entries") {
      return { entries: [samplePost()], total: 1, page: 1, perPage: 25 };
    }
    throw new Error(`Unexpected request to ${url.pathname}`);
  });
}

function entryListRequests(calls: Array<{ url: URL }>) {
  return calls
    .filter(({ url }) => url.pathname.endsWith("/entries"))
    .map(({ url }) => url.searchParams);
}

afterEach(() => vi.restoreAllMocks());

describe("entriesListPath", () => {
  it("leaves out empty filters, so cleared and never-set filters share a cache entry", () => {
    expect(entriesListPath("posts", { search: "  ", page: 1 })).toBe(
      "/collections/posts/entries?page=1&perPage=25",
    );
    expect(entriesListPath("posts", { status: "draft", search: "Hello", page: 2 })).toBe(
      "/collections/posts/entries?status=draft&search=Hello&page=2&perPage=25",
    );
  });
});

describe("EntriesListPage", () => {
  it("asks the API for drafts when the Drafts filter is chosen", async () => {
    const api = answerLikeTheApi();
    renderScreen(<EntriesListWithFilter />);
    await screen.findByText("Hello world");

    await userEvent.click(screen.getByRole("radio", { name: "Drafts" }));

    await waitFor(() => expect(entryListRequests(api.calls).at(-1)?.get("status")).toBe("draft"));
    expect(entryListRequests(api.calls).at(-1)?.get("page")).toBe("1");
  });

  it("searches once typing pauses, not on every key", async () => {
    const api = answerLikeTheApi();
    renderScreen(<EntriesListWithFilter />);
    await screen.findByText("Hello world");
    const requestsBefore = entryListRequests(api.calls).length;

    await userEvent.type(screen.getByRole("searchbox", { name: "Search blog posts" }), "launch");

    await waitFor(() => expect(entryListRequests(api.calls).at(-1)?.get("search")).toBe("launch"));
    expect(entryListRequests(api.calls).length).toBe(requestsBefore + 1);
  });

  it("shows each entry's status and who changed it", async () => {
    answerLikeTheApi();
    renderScreen(<EntriesListWithFilter />);

    const link = await screen.findByRole("link", { name: /Hello world/ });
    expect(link).toHaveTextContent("Draft");
    expect(link).toHaveTextContent("by Ada Lovelace");
  });

  it("only offers New entry to people who can create entries", async () => {
    answerLikeTheApi();
    renderScreen(<EntriesListWithFilter />, { permissions: ["entries:read"] });

    await screen.findByText("Hello world");

    expect(screen.queryByRole("link", { name: "New entry" })).not.toBeInTheDocument();
  });
});
