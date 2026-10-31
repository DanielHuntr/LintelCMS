import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardPage } from "./DashboardPage.js";

describe("DashboardPage", () => {
  it("shows the Sales card when the online shop is switched on", () => {
    render(<DashboardPage showSales />);

    expect(screen.getByText("Sales")).toBeInTheDocument();
  });

  it("leaves Sales out for sites without a shop", () => {
    render(<DashboardPage showSales={false} />);

    expect(screen.queryByText("Sales")).not.toBeInTheDocument();
    expect(screen.getByText("Recent edits and tasks will appear here.")).toBeInTheDocument();
  });
});
