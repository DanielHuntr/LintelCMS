import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { CustomerDetailPage } from "./CustomerDetailPage.js";
import type { Customer } from "./orders.api.js";
import { OrdersPage } from "./OrdersPage.js";
import type { ArchivedOrder } from "./shopifyImport.api.js";

/*
 * Orders brought over from Shopify are kept as records, not live orders. The customer page
 * and the Orders list still have to tell one story about them (LINTEL-DATA-002).
 */

afterEach(() => vi.restoreAllMocks());

const withShop = { enabledPlugins: ["commerce"] };

const ada: Customer = {
  id: "c1",
  email: "ada@example.com",
  name: "Ada Lovelace",
  phone: "",
  note: "",
  addresses: [],
  orderCount: 1,
  totalSpent: [{ amount: 8695, currency: "GBP" }],
  createdAt: "2026-11-02T16:30:52.000Z",
  customerSince: "2026-03-01T10:14:02.000Z",
};

const adasOldOrder: ArchivedOrder = {
  id: "a1",
  name: "#1001",
  email: "ada@example.com",
  customerId: "c1",
  total: { amount: 8695, currency: "GBP" },
  paymentStatus: "paid",
  fulfilmentStatus: "fulfilled",
  itemCount: 2,
  placedAt: "2026-03-01T10:14:02.000Z",
};

const gracesOldOrder: ArchivedOrder = {
  ...adasOldOrder,
  id: "a2",
  name: "#1002",
  email: "grace@example.com",
  customerId: "c2",
  total: { amount: 1850, currency: "USD" },
  paymentStatus: "refunded",
  itemCount: 1,
  placedAt: "2026-04-12T20:40:00.000Z",
};

describe("a customer with orders from before the move", () => {
  it("counts them: no 'No orders yet', what they spent, and since when", async () => {
    mockApi(({ url }) => {
      if (url.pathname === "/shop/customers/c1") return ada;
      if (url.pathname === "/shop/orders") return { items: [], total: 0 };
      if (url.pathname === "/shop/archived-orders") return { items: [adasOldOrder], total: 1 };
      return undefined;
    });
    renderScreen(<CustomerDetailPage customerId="c1" />, withShop);

    expect(await screen.findByText("Customer since Mar 1, 2026")).toBeInTheDocument();
    expect(await screen.findByText("Orders before the move")).toBeInTheDocument();
    expect(screen.getByText("£86.95")).toBeInTheDocument();
    expect(screen.queryByText("No orders yet.")).not.toBeInTheDocument();
    expect(screen.queryByText("Nothing yet.")).not.toBeInTheDocument();
  });
});

describe("the Orders list after a move from Shopify", () => {
  it("offers the imported orders, each leading to its customer", async () => {
    mockApi(({ url }) => {
      if (url.pathname === "/shop/orders") return { items: [], total: 0 };
      if (url.pathname === "/shop/archived-orders") {
        return { items: [gracesOldOrder, adasOldOrder], total: 2 };
      }
      return undefined;
    });
    renderScreen(<OrdersPage />, withShop);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("radio", { name: "Imported" }));

    const adaRow = await screen.findByRole("link", { name: /#1001 · ada@example.com/ });
    expect(adaRow).toHaveAttribute("href", "/commerce/customers/c1");
    expect(screen.getByRole("link", { name: /#1002 · grace@example.com/ })).toBeInTheDocument();
    expect(screen.queryByText("No orders yet")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Search by order number, name or email"), "grace");
    await vi.waitFor(() =>
      expect(screen.queryByRole("link", { name: /#1001/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: /#1002/ })).toBeInTheDocument();
  });

  it("doesn't offer Imported when nothing was imported", async () => {
    mockApi(({ url }) => {
      if (url.pathname === "/shop/orders") return { items: [], total: 0 };
      if (url.pathname === "/shop/archived-orders") return { items: [], total: 0 };
      return undefined;
    });
    renderScreen(<OrdersPage />, withShop);

    expect(await screen.findByText("No orders yet")).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Imported" })).not.toBeInTheDocument();
  });
});

describe("the Orders list with only imported orders (LINTEL-LEFT-003)", () => {
  it("points to Imported instead of saying 'No orders yet'", async () => {
    mockApi(({ url }) => {
      if (url.pathname === "/shop/orders") return { items: [], total: 0 };
      if (url.pathname === "/shop/archived-orders") {
        return { items: [gracesOldOrder, adasOldOrder], total: 2 };
      }
      return undefined;
    });
    renderScreen(<OrdersPage />, withShop);

    expect(await screen.findByText("No orders placed in this shop yet")).toBeInTheDocument();
    expect(
      screen.getByText("The 2 orders you brought over from Shopify are under Imported."),
    ).toBeInTheDocument();
    expect(screen.queryByText("No orders yet")).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Show imported orders" }));
    expect(await screen.findByText("#1002 · grace@example.com")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Imported" })).toBeChecked();
  });

  it("still says 'No orders yet' when nothing was imported", async () => {
    mockApi(({ url }) => {
      if (url.pathname === "/shop/orders") return { items: [], total: 0 };
      if (url.pathname === "/shop/archived-orders") return { items: [], total: 0 };
      return undefined;
    });
    renderScreen(<OrdersPage />, withShop);
    expect(await screen.findByText("No orders yet")).toBeInTheDocument();
  });
});
