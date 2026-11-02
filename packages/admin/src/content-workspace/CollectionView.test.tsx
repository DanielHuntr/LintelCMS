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
      url: null,
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
      url: null,
    },
  ],
  columns: [{ handle: "price", label: "Price", type: "number" }],
  total: 2,
  page: 1,
  perPage: 25,
  canSortByHand: true,
  types: [{ handle: "products", name: "Products" }],
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

    await screen.findByText("Published 1 page.");
    expect(screen.getByText("Rye: Add a price.")).toBeTruthy();
    const bulk = api.calls.find((call) => call.url.pathname.endsWith("/content-tree/bulk"));
    expect(bulk?.body).toEqual({ action: "publish", entryIds: ["a1", "a2"] });
  });

  it("asks once before deleting, saying what is inside, then offers Undo", async () => {
    const api = mockApi(({ method, url }) => {
      if (url.pathname.endsWith("/content-tree/items")) return items;
      if (url.pathname.endsWith("/content-tree/bulk/summary")) {
        return {
          items: [
            { id: "a1", title: "Sourdough", descendantCount: 2 },
            { id: "a2", title: "Rye", descendantCount: 0 },
          ],
          totalCount: 4,
        };
      }
      if (url.pathname.endsWith("/content-tree/bulk")) {
        return { changed: ["a1", "a2"], skipped: [], recycleBinItemIds: ["b1", "b2"] };
      }
      if (url.pathname.includes("/recycle-bin/")) {
        return { entryId: "a1", parentId: null, restoredCount: 1 };
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
    await userEvent.click(screen.getByRole("button", { name: "Delete…" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete 2 pages?" });
    expect(await within(dialog).findByText("and 2 pages inside")).toBeTruthy();
    expect(within(dialog).getByText(/4 pages in all/)).toBeTruthy();
    expect(api.calls.some((call) => call.url.pathname.endsWith("/content-tree/bulk"))).toBe(false);
    await userEvent.click(within(dialog).getByRole("button", { name: "Move to recycle bin" }));

    await screen.findByText("Moved 2 pages to the recycle bin.");
    expect(
      api.calls.find((call) => call.url.pathname.endsWith("/content-tree/bulk"))?.body,
    ).toEqual({ action: "recycle", entryIds: ["a1", "a2"] });

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await screen.findByText("Brought 2 pages back.");
    const restored = api.calls.filter((call) => call.url.pathname.includes("/recycle-bin/"));
    expect(restored.map((call) => call.url.pathname)).toEqual([
      "/recycle-bin/b1/restore",
      "/recycle-bin/b2/restore",
    ]);
  });

  it("lists every level with addresses and filters by type", async () => {
    const pages = {
      ...items,
      items: items.items.map((item, index) => ({ ...item, url: index ? "/about" : "/" })),
      types: [
        { handle: "pages", name: "Pages" },
        { handle: "landing", name: "Landing pages" },
      ],
    };
    const api = mockApi(({ url }) => {
      if (url.pathname.endsWith("/content-tree/items")) return pages;
      throw new Error(`Unexpected ${url.pathname}`);
    });
    renderScreen(
      <WithTestTree>
        <CollectionView place={{ collection: "pages" }} placeName="Pages" allLevels />
      </WithTestTree>,
    );

    const table = await screen.findByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Address" })).toBeTruthy();
    expect(within(table).getByText("/about")).toBeTruthy();
    expect(api.calls[0]?.url.searchParams.get("allLevels")).toBe("true");
    await userEvent.selectOptions(screen.getByLabelText("Type"), "landing");
    await waitFor(() => expect(api.calls.at(-1)?.url.searchParams.get("type")).toBe("landing"));
  });
});
