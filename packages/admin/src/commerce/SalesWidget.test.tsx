import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../dashboard/DashboardPage.js";
import { AdminPluginsContext } from "../plugins/AdminPluginsContext.js";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { commerceAdminPlugin } from "./commerce.adminPlugin.js";

function serveDashboardWithSales() {
  return mockApi(({ url }) => {
    if (url.pathname === "/dashboard/layout") return { widgets: null, source: "default" };
    if (url.pathname === "/shop/sales/summary") {
      return {
        days: 30,
        primaryCurrency: "GBP",
        byCurrency: [
          {
            currency: "GBP",
            sales: { amount: 12_500, currency: "GBP" },
            orderCount: 3,
            averageOrder: { amount: 4167, currency: "GBP" },
          },
        ],
        daily: [],
        ordersToFulfil: 1,
      };
    }
    if (url.pathname.startsWith("/dashboard/widgets/")) return { entries: [], total: 0 };
    throw new Error(`Unexpected request: ${url.pathname}`);
  });
}

function renderDashboard(options: { permissions?: string[]; enabledPlugins?: string[] }) {
  return renderScreen(
    <AdminPluginsContext.Provider value={[commerceAdminPlugin]}>
      <DashboardPage />
    </AdminPluginsContext.Provider>,
    options,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("the dashboard's Sales widget", () => {
  it("is on the default dashboard while the online shop is on", async () => {
    serveDashboardWithSales();
    renderDashboard({ permissions: ["commerce:read"], enabledPlugins: ["commerce"] });

    expect(await screen.findByText("£125.00", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sales" })).toBeInTheDocument();
    expect(screen.getByText("1 order waiting to be sent")).toBeInTheDocument();
  }, 15_000);

  it("isn't shown while the shop is off", async () => {
    serveDashboardWithSales();
    renderDashboard({ permissions: ["commerce:read"], enabledPlugins: [] });

    await screen.findByRole("heading", { name: "Welcome" }, { timeout: 5000 });
    expect(screen.queryByRole("heading", { name: "Sales" })).not.toBeInTheDocument();
  }, 15_000);
});
