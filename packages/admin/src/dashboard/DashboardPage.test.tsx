import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { DashboardPage } from "./DashboardPage.js";

afterEach(() => vi.restoreAllMocks());

describe("DashboardPage", () => {
  it("shows the Sales card when the online shop is switched on", async () => {
    mockApi(() => ({
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
    }));
    renderScreen(<DashboardPage showSales />, { enabledPlugins: ["commerce"] });

    expect(await screen.findByText("£125.00")).toBeInTheDocument();
    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText("1 order waiting to be sent")).toBeInTheDocument();
  });

  it("leaves Sales out for sites without a shop", () => {
    render(<DashboardPage showSales={false} />);

    expect(screen.queryByText("Sales")).not.toBeInTheDocument();
    expect(screen.getByText("Recent edits and tasks will appear here.")).toBeInTheDocument();
  });
});
