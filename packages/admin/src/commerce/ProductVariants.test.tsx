import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { apiErrorResponse, mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { ProductEditorPage } from "./ProductEditorPage.js";
import type { InventoryLocation, Product, ProductInput, Variant } from "./products.api.js";

const main: InventoryLocation = { id: "main", name: "Main location", isActive: true };
const market = {
  id: "m1",
  name: "UK",
  handle: "uk",
  currency: "GBP",
  countries: ["GB"],
  isPrimary: true,
  exchangeRate: 1,
};

function variant(optionValues: string[], amount: number, onHand: number | null): Variant {
  const name = optionValues.join("-") || "only";
  return {
    id: `v-${name}`,
    title: optionValues.join(" / "),
    optionValues,
    sku: `SKU-${name}`,
    barcode: null,
    weightGrams: 200,
    inventoryTracked: onHand !== null,
    prices: [{ currency: "GBP", amount, compareAtAmount: null }],
    stock: onHand === null ? [] : [{ locationId: "main", onHand }],
    available: onHand,
    held: 0,
  };
}

function product(options: Product["options"], variants: Variant[]): Product {
  return {
    id: "p1",
    title: "Overshirt",
    handle: "overshirt",
    description: null,
    status: "draft",
    vendor: "",
    productType: "",
    tags: [],
    mediaIds: [],
    seoTitle: "",
    seoDescription: "",
    options,
    variants,
    createdAt: "2026-11-01T10:00:00Z",
    updatedAt: "2026-11-01T10:00:00Z",
  };
}

const oneOption = product(
  [{ name: "Size", values: ["S", "M", "L"] }],
  [variant(["S"], 1000, 3), variant(["M"], 1000, 4), variant(["L"], 1200, 5)],
);

const twoOptions = product(
  [
    { name: "Size", values: ["S", "M"] },
    { name: "Colour", values: ["Oat", "Ink"] },
  ],
  [
    variant(["S", "Oat"], 1000, 1),
    variant(["S", "Ink"], 1100, 2),
    variant(["M", "Oat"], 1200, 3),
    variant(["M", "Ink"], 1200, 4),
  ],
);

const noOptions = product([], [variant([], 900, 12)]);

function open(
  shown: Product,
  {
    locations = [main],
    saveError,
  }: { locations?: InventoryLocation[]; saveError?: () => Response } = {},
) {
  const api = mockApi(({ method, url, body }) => {
    if (url.pathname === "/shop/locations") return { locations };
    if (url.pathname === "/shop/markets") return { markets: [market] };
    if (url.pathname === "/shop/collections") return { collections: [] };
    if (method === "PUT" && url.pathname === "/shop/products/p1") {
      if (saveError) throw saveError();
      return { ...shown, ...(body as object), updatedAt: "2026-11-02T10:00:00Z" };
    }
    if (url.pathname === "/shop/products/p1") return shown;
    return [];
  });
  renderScreen(<ProductEditorPage productId="p1" />, { enabledPlugins: ["commerce"] });
  return api;
}

async function save(api: ReturnType<typeof mockApi>): Promise<ProductInput> {
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(api.calls.some((call) => call.method === "PUT")).toBe(true));
  return api.calls.find((call) => call.method === "PUT")?.body as ProductInput;
}

const priceOf = (input: ProductInput, values: string[]) =>
  input.variants.find((item) => item.optionValues.join() === values.join())?.prices[0]?.amount;
const stockOf = (input: ProductInput, values: string[]) =>
  input.variants.find((item) => item.optionValues.join() === values.join())?.stock[0]?.onHand;

beforeAll(() => {
  // jsdom has no modal dialogs.
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.open = false;
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("a product without options", () => {
  it("keeps the single form, with no table", async () => {
    open(noOptions);
    expect(await screen.findByRole("heading", { name: "Price and stock" })).toBeInTheDocument();
    expect(screen.getByLabelText("Price (GBP)")).toHaveValue("9.00");
    expect(screen.getByLabelText("In stock at Main location")).toHaveValue("12");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("still shows the single form while a new option has no choices", async () => {
    open(noOptions);
    await userEvent.click(await screen.findByRole("button", { name: "Add an option" }));
    expect(screen.getByRole("heading", { name: "Price and stock" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("moves to a table with the first choice, keeping the details", async () => {
    const api = open(noOptions);
    await userEvent.click(await screen.findByRole("button", { name: "Add an option" }));
    await userEvent.type(screen.getByLabelText("Option"), "Size");
    await userEvent.type(screen.getByLabelText("Choices"), "S{Enter}");
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Price and stock" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Price for S")).toHaveValue("9.00");

    const input = await save(api);
    expect(input.options).toEqual([{ name: "Size", values: ["S"] }]);
    expect(input.variants[0]).toMatchObject({ id: "v-only", optionValues: ["S"], sku: "SKU-only" });
  });
});

describe("the variants table", () => {
  it("is one row per variant with price, stock and SKU in the row", async () => {
    open(oneOption);
    const table = await screen.findByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Price (GBP)" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "In stock" })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "M" })).toBeInTheDocument();
    expect(screen.getByLabelText("Price for M")).toHaveValue("10.00");
    expect(screen.getByLabelText("In stock for M")).toHaveValue("4");
    expect(screen.getByLabelText("SKU for M")).toHaveValue("SKU-M");
    // Nothing from the old card per variant.
    expect(screen.queryByLabelText("Was price")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "M" })).not.toBeInTheDocument();
  });

  it("saves what's typed in the rows, leaving the rest as it was", async () => {
    const api = open(oneOption);
    const price = await screen.findByLabelText("Price for M");
    await userEvent.clear(price);
    await userEvent.type(price, "15.50");
    const stock = screen.getByLabelText("In stock for L");
    await userEvent.clear(stock);
    await userEvent.type(stock, "9");
    const sku = screen.getByLabelText("SKU for S");
    await userEvent.clear(sku);
    await userEvent.type(sku, "NEW");

    const input = await save(api);
    expect(priceOf(input, ["M"])).toBe(1550);
    expect(stockOf(input, ["L"])).toBe(9);
    expect(input.variants[0]).toMatchObject({ id: "v-S", sku: "NEW", weightGrams: 200 });
    expect(priceOf(input, ["S"])).toBe(1000);
  });

  it("shows the total stock in the footer and keeps it up to date", async () => {
    open(oneOption);
    const footer = (await screen.findByText("Total in stock: 12")).closest("tfoot");
    expect(footer).not.toBeNull();
    expect(within(footer as HTMLElement).getByText("3 variants")).toBeInTheDocument();
    const stock = screen.getByLabelText("In stock for S");
    await userEvent.clear(stock);
    await userEvent.type(stock, "10");
    expect(screen.getByText("Total in stock: 19")).toBeInTheDocument();
  });

  it("says which variants aren't counted, and counts one once a number is typed", async () => {
    const api = open(
      product(
        [{ name: "Size", values: ["S", "M"] }],
        [variant(["S"], 1000, 3), variant(["M"], 1000, null)],
      ),
    );
    expect(await screen.findByText("Total in stock: 3 (1 not counted)")).toBeInTheDocument();
    const stock = screen.getByLabelText("In stock for M");
    expect(stock).toHaveAttribute("placeholder", "Not counted");
    await userEvent.type(stock, "6");
    expect(screen.getByText("Total in stock: 9")).toBeInTheDocument();
    const input = await save(api);
    expect(input.variants[1]).toMatchObject({
      inventoryTracked: true,
      stock: [{ locationId: "main", onHand: 6 }],
    });
  });

  it("has no tick boxes for a single variant", async () => {
    open(product([{ name: "Size", values: ["S"] }], [variant(["S"], 1000, 3)]));
    await screen.findByLabelText("Price for S");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("edits the chosen location when the shop has several, and totals them all", async () => {
    const annexe = { id: "annexe", name: "Annexe", isActive: true };
    const api = open(oneOption, { locations: [main, annexe] });
    const stockLocation = await screen.findByLabelText("Stock at");
    expect(screen.getByLabelText("In stock at Main location for S")).toHaveValue("3");
    await userEvent.selectOptions(stockLocation, "Annexe");
    await userEvent.type(screen.getByLabelText("In stock at Annexe for S"), "20");
    expect(screen.getByText("Total in stock: 32")).toBeInTheDocument();
    const input = await save(api);
    expect(input.variants[0]?.stock).toEqual([
      { locationId: "main", onHand: 3 },
      { locationId: "annexe", onHand: 20 },
    ]);
  });
});

describe("a variant's other details", () => {
  it("opens from the Edit button, saves them, and returns focus to the row", async () => {
    const api = open(oneOption);
    const edit = await screen.findByRole("button", { name: "Edit M" });
    await userEvent.click(edit);
    const sheet = screen.getByRole("dialog", { name: "M" });
    await userEvent.type(within(sheet).getByLabelText("Was price"), "20");
    await userEvent.type(within(sheet).getByLabelText("Barcode"), "123");
    const weight = within(sheet).getByLabelText("Weight (grams)");
    await userEvent.clear(weight);
    await userEvent.type(weight, "350");
    await userEvent.click(within(sheet).getByRole("button", { name: "Done" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit M" })).toHaveFocus();

    const input = await save(api);
    expect(input.variants[1]).toMatchObject({ barcode: "123", weightGrams: 350 });
    expect(input.variants[1]?.prices[0]).toMatchObject({ amount: 1000, compareAtAmount: 2000 });
  });

  it("opens from a click on the row, but not from a click on its boxes", async () => {
    open(oneOption);
    const price = await screen.findByLabelText("Price for M");
    await userEvent.click(price);
    await userEvent.click(screen.getByRole("checkbox", { name: "Select M" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("rowheader", { name: "M" }));
    expect(screen.getByRole("dialog", { name: "M" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
  });

  it("returns focus to the row after opening with a click on the row", async () => {
    open(oneOption);
    await userEvent.click(await screen.findByRole("rowheader", { name: "L" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("button", { name: "Edit L" })).toHaveFocus();
  });

  it("turning off stock counting in the sheet shows in the row", async () => {
    open(oneOption);
    await userEvent.click(await screen.findByRole("button", { name: "Edit S" }));
    await userEvent.click(screen.getByRole("switch", { name: "Count stock" }));
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByLabelText("In stock for S")).toHaveValue("");
    expect(screen.getByLabelText("In stock for S")).toHaveAttribute("placeholder", "Not counted");
  });

  it("doesn't save the product when Enter is pressed in the sheet", async () => {
    const api = open(oneOption);
    await userEvent.click(await screen.findByRole("button", { name: "Edit S" }));
    await userEvent.type(screen.getByLabelText("Barcode"), "9{Enter}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.calls.some((call) => call.method === "PUT")).toBe(false);
  });
});

describe("groups", () => {
  it("folds rows under the first option", async () => {
    open(twoOptions);
    const show = await screen.findByRole("button", { name: /^S ?\d/ });
    expect(show).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Price for S / Oat")).not.toBeInTheDocument();
    expect(screen.getByText("2 variants, 3 in stock")).toBeInTheDocument();
    await userEvent.click(show);
    expect(show).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Price for S / Oat")).toHaveValue("10.00");
    expect(screen.queryByLabelText("Price for M / Oat")).not.toBeInTheDocument();
  });

  it("can group by another option, or not at all", async () => {
    open(twoOptions);
    const groupBy = await screen.findByLabelText("Group by");
    await userEvent.selectOptions(groupBy, "Colour");
    expect(screen.getByRole("button", { name: /^Ink ?\d/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^S ?\d/ })).not.toBeInTheDocument();
    await userEvent.selectOptions(groupBy, "Don’t group");
    expect(screen.queryByRole("button", { name: /\d variants/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Price for M / Ink")).toBeInTheDocument();
  });

  it("offers no grouping for a single option", async () => {
    open(oneOption);
    await screen.findByLabelText("Price for S");
    expect(screen.queryByLabelText("Group by")).not.toBeInTheDocument();
  });

  it("sets the price and stock of every variant in a group, folded or not", async () => {
    const api = open(twoOptions);
    const price = await screen.findByLabelText("Price for all S variants");
    expect(price).toHaveValue("");
    expect(price).toHaveAttribute("placeholder", "Set all");
    await userEvent.type(price, "30{Enter}");
    expect(price).toHaveValue("30");
    const stock = screen.getByLabelText("In stock for each S variant");
    await userEvent.type(stock, "7");
    await userEvent.tab();

    const input = await save(api);
    expect(priceOf(input, ["S", "Oat"])).toBe(3000);
    expect(priceOf(input, ["S", "Ink"])).toBe(3000);
    expect(stockOf(input, ["S", "Ink"])).toBe(7);
    expect(priceOf(input, ["M", "Oat"])).toBe(1200);
  });

  it("shows the price a group shares", async () => {
    open(twoOptions);
    expect(await screen.findByLabelText("Price for all M variants")).toHaveValue("12.00");
  });

  it("leaves different prices alone when typing is rubbed out or cancelled", async () => {
    const api = open(twoOptions);
    const price = await screen.findByLabelText("Price for all S variants");
    await userEvent.type(price, "30{Backspace}{Backspace}");
    await userEvent.tab();
    await userEvent.type(price, "99{Escape}");
    await userEvent.tab();
    const input = await save(api);
    expect(priceOf(input, ["S", "Oat"])).toBe(1000);
    expect(priceOf(input, ["S", "Ink"])).toBe(1100);
  });

  it("stays open after saving", async () => {
    const api = open(twoOptions);
    await userEvent.click(await screen.findByRole("button", { name: /^M ?\d/ }));
    const before = screen.getByLabelText("Price for M / Oat");
    await save(api);
    // Saving redraws the form, so the old box goes.
    await waitFor(() => expect(before).not.toBeInTheDocument());
    expect(await screen.findByLabelText("Price for M / Oat")).toBeInTheDocument();
  });

  it("opens a group by itself when one of its rows has a problem", async () => {
    const api = open(twoOptions, {
      saveError: () =>
        apiErrorResponse(400, "INVALID_FIELDS", "Check these", {
          "variants.3.sku": "Two variants can't share a SKU",
        }),
    });
    await screen.findByRole("button", { name: /^M ?\d/ });
    await save(api);
    const message = await screen.findByText("Two variants can't share a SKU");
    expect(screen.getByRole("button", { name: /^M ?\d/ })).toHaveAttribute("aria-expanded", "true");
    const box = screen.getByLabelText("SKU for M / Ink");
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAttribute("aria-describedby", message.id);
  });
});

describe("tick boxes", () => {
  it("changes the price of the ticked variants", async () => {
    const api = open(oneOption);
    await userEvent.click(await screen.findByRole("checkbox", { name: "Select S" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select L" }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Set price" }));
    const dialog = screen.getByRole("dialog", { name: "Set the price of 2 variants" });
    await userEvent.type(within(dialog).getByLabelText("Price (GBP)"), "25{Enter}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Price set for 2 variants")).toBeInTheDocument();

    const input = await save(api);
    expect(priceOf(input, ["S"])).toBe(2500);
    expect(priceOf(input, ["M"])).toBe(1000);
    expect(priceOf(input, ["L"])).toBe(2500);
  });

  it("select all includes folded rows, and sets their stock", async () => {
    const api = open(twoOptions);
    const all = await screen.findByRole("checkbox", { name: "Select all" });
    await userEvent.click(all);
    expect(all).toBeChecked();
    expect(screen.getByText("4 selected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Set stock" }));
    await userEvent.type(screen.getByLabelText("In stock"), "8");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByText("Total in stock: 32")).toBeInTheDocument();
    const input = await save(api);
    expect(input.variants.every((item) => item.stock[0]?.onHand === 8)).toBe(true);
  });

  it("shows part of a group or the whole list as partly ticked", async () => {
    open(twoOptions);
    await userEvent.click(await screen.findByRole("button", { name: /^S ?\d/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select S / Oat" }));
    const group = screen.getByRole<HTMLInputElement>("checkbox", { name: "Select all S variants" });
    expect(group.indeterminate).toBe(true);
    await userEvent.click(group);
    expect(group).toBeChecked();
    expect(
      screen.getByRole<HTMLInputElement>("checkbox", { name: "Select all" }).indeterminate,
    ).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(group).not.toBeChecked();
    expect(screen.queryByRole("group", { name: "Change the selected variants" })).toBeNull();
  });

  it("won't set a price that isn't one", async () => {
    open(oneOption);
    await userEvent.click(await screen.findByRole("checkbox", { name: "Select all" }));
    await userEvent.click(screen.getByRole("button", { name: "Set price" }));
    await userEvent.type(screen.getByLabelText("Price (GBP)"), "lots{Enter}");
    expect(screen.getByText("Enter a price, such as 12.50.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("Price for S")).toHaveValue("10.00");
  });
});

describe("choices as chips", () => {
  it("adds a chip for a comma, for Enter and for leaving the box, without saving", async () => {
    const api = open(noOptions);
    await userEvent.click(await screen.findByRole("button", { name: "Add an option" }));
    await userEvent.type(screen.getByLabelText("Option"), "Size");
    const box = screen.getByLabelText("Choices");
    await userEvent.type(box, "S,");
    expect(box).toHaveValue("");
    await userEvent.type(box, "M{Enter}");
    await userEvent.type(box, "L");
    await userEvent.tab();
    for (const name of ["S", "M", "L"]) {
      expect(screen.getByRole("button", { name: `Remove choice ${name}` })).toBeInTheDocument();
    }
    expect(api.calls.some((call) => call.method === "PUT")).toBe(false);
    const input = await save(api);
    expect(input.options).toEqual([{ name: "Size", values: ["S", "M", "L"] }]);
    expect(input.variants).toHaveLength(3);
  });

  it("makes several from a pasted list and ignores repeats", async () => {
    open(oneOption);
    await screen.findByLabelText("Choices");
    const box = screen.getByLabelText("Choices");
    await userEvent.click(box);
    await userEvent.paste("M, XL, XXL,");
    expect(screen.getAllByRole("button", { name: /^Remove choice/ })).toHaveLength(5);
    expect(screen.getByLabelText("Price for XXL")).toBeInTheDocument();
  });

  it("keeps what was typed but not finished when going straight to Save", async () => {
    const api = open(oneOption);
    await userEvent.type(await screen.findByLabelText("Choices"), "XL");
    const input = await save(api);
    expect(input.options[0]?.values).toEqual(["S", "M", "L", "XL"]);
  });

  it("removing a choice keeps the other variants' details", async () => {
    const api = open(oneOption);
    await userEvent.click(await screen.findByRole("button", { name: "Remove choice M" }));
    expect(screen.queryByLabelText("Price for M")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Choices")).toHaveFocus();
    const input = await save(api);
    expect(input.variants.map((item) => item.id)).toEqual(["v-S", "v-L"]);
    expect(input.variants[1]).toMatchObject({ sku: "SKU-L", weightGrams: 200 });
    expect(priceOf(input, ["L"])).toBe(1200);
  });

  it("restores everything about a choice removed by mistake", async () => {
    const api = open(oneOption);
    await userEvent.click(await screen.findByRole("button", { name: "Remove choice M" }));
    await userEvent.type(screen.getByLabelText("Choices"), "M{Enter}");
    expect(screen.getByLabelText("SKU for M")).toHaveValue("SKU-M");
    const input = await save(api);
    expect(input.variants.find((item) => item.optionValues[0] === "M")).toMatchObject({
      id: "v-M",
      sku: "SKU-M",
    });
  });

  it("changing a chip's wording keeps the variant and its details", async () => {
    const api = open(oneOption);
    await userEvent.click(await screen.findByRole("button", { name: "Change choice M" }));
    const box = screen.getByRole("textbox", { name: "Change choice M" });
    await userEvent.clear(box);
    await userEvent.type(box, "Medium{Enter}");
    expect(screen.getByLabelText("SKU for Medium")).toHaveValue("SKU-M");
    const input = await save(api);
    expect(input.options[0]?.values).toEqual(["S", "Medium", "L"]);
    expect(input.variants[1]).toMatchObject({ id: "v-M", optionValues: ["Medium"], sku: "SKU-M" });
  });

  it("Escape puts a chip's wording back", async () => {
    open(oneOption);
    await userEvent.click(await screen.findByRole("button", { name: "Change choice M" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Change choice M" }), "x{Escape}");
    expect(screen.getByRole("button", { name: "Remove choice M" })).toBeInTheDocument();
    expect(screen.getByLabelText("Price for M")).toBeInTheDocument();
  });

  it("Backspace in the empty box moves to the last chip, and a second one removes it", async () => {
    open(oneOption);
    await userEvent.click(await screen.findByLabelText("Choices"));
    await userEvent.keyboard("{Backspace}");
    expect(screen.getByRole("button", { name: "Remove choice L" })).toHaveFocus();
    await userEvent.keyboard("{Backspace}");
    expect(screen.queryByRole("button", { name: "Remove choice L" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Choices")).toHaveFocus();
  });

  it("renaming an option leaves combinations an import left out still missing", async () => {
    const partial = product(twoOptions.options, twoOptions.variants.slice(0, 3));
    const api = open(partial);
    const [first] = await screen.findAllByLabelText("Option");
    fireEvent.change(first as HTMLElement, { target: { value: "Fit" } });
    const input = await save(api);
    expect(input.variants).toHaveLength(3);
    expect(input.options[0]?.name).toBe("Fit");
  });

  it("asks for an option's name rather than failing to save", async () => {
    const api = open(noOptions);
    await userEvent.click(await screen.findByRole("button", { name: "Add an option" }));
    await userEvent.type(screen.getByLabelText("Choices"), "S{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Give this option a name, such as Size.")).toBeInTheDocument();
    expect(api.calls.some((call) => call.method === "PUT")).toBe(false);
  });
});
