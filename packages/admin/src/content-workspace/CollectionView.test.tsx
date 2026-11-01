import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testNode, WithTestTree } from "../content-tree/testTree.js";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { CollectionView } from "./CollectionView.js";

afterEach(() => vi.restoreAllMocks());

const items = {
  items: [
    {
      ...testNode({
        id: "a1",
        title: "Sourdough",
        collection: { handle: "products", name: "Products" },
      }),
      values: { price: 450 },
      updatedBy: "Ada",
    },
    {
      ...testNode({
        id: "a2",
        title: "Rye",
        status: "published",
        collection: { handle: "products", name: "Products" },
      }),
      values: { price: 380 },
      updatedBy: null,
    },
  ],
  columns: [{ handle: "price", label: "Price", type: "number" }],
  total: 2,
  page: 1,
  perPage: 25,
  canSortByHand: true,
};

describe("the collection view", () => {
  it("lists entries with their columns and sorts by a column", async () => {
    const api = mockApi(({ url }) => {
      if (url.pathname.endsWith("/content-tree/items")) return items;
      throw new Error(`Unexpected ${url.pathname}`);
    });
    renderScreen(
      <WithTestTree>
        <CollectionView place={{ collection: "products" }} placeName="Products" />
      </WithTestTree>,
    );

    const table = await screen.findByRole("table");
    expect(within(table).getByRole("columnheader", { name: /Price/ })).toBeTruthy();
    expect(within(table).getByRole("link", { name: "Sourdough" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Sort by Price" }));
    await waitFor(() => expect(api.calls.at(-1)?.url.searchParams.get("sort")).toBe("field:price"));
  });

  it("publishes the selected entries at once and says what happened", async () => {
    const api = mockApi(({ method, url }) => {
      if (url.pathname.endsWith("/content-tree/items")) return items;
      if (method === "POST" && url.pathname.endsWith("/content-tree/bulk")) {
        return { changed: ["a1"], skipped: [{ id: "a2", title: "Rye", reason: "Add a price." }] };
      }
      throw new Error(`Unexpected ${method} ${url.pathname}`);
    });
    renderScreen(
      <WithTestTree>
        <CollectionView place={{ collection: "products" }} placeName="Products" />
      </WithTestTree>,
    );

    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select everything on this page" }),
    );
    const toolbar = screen.getByRole("toolbar", { name: "2 selected" });
    await userEvent.click(within(toolbar).getByRole("button", { name: "Publish" }));

    await screen.findByText("Done: 1 changed.");
    expect(screen.getByText("Rye: Add a price.")).toBeTruthy();
    const bulk = api.calls.find((call) => call.url.pathname.endsWith("/content-tree/bulk"));
    expect(bulk?.body).toEqual({ action: "publish", entryIds: ["a1", "a2"] });
  });

  it("asks before moving the selected entries to the recycle bin", async () => {
    const api = mockApi(({ method, url }) => {
      if (url.pathname.endsWith("/content-tree/items")) return items;
      if (method === "POST") return { changed: ["a1"], skipped: [] };
      throw new Error(`Unexpected ${method} ${url.pathname}`);
    });
    renderScreen(
      <WithTestTree>
        <CollectionView place={{ collection: "products" }} placeName="Products" />
      </WithTestTree>,
    );

    await userEvent.click(await screen.findByRole("checkbox", { name: "Select Sourdough" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete…" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete 1 item?" });
    expect(api.calls.some((call) => call.method === "POST")).toBe(false);
    await userEvent.click(within(dialog).getByRole("button", { name: "Move to recycle bin" }));

    await waitFor(() =>
      expect(api.calls.find((call) => call.method === "POST")?.body).toEqual({
        action: "recycle",
        entryIds: ["a1"],
      }),
    );
  });
});
