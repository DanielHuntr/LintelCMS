import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { FoldingPanelContext, PanelSection } from "./PanelSection.js";

function folding(section: React.ReactNode) {
  return render(<FoldingPanelContext value={true}>{section}</FoldingPanelContext>);
}

describe("a section of the side panel", () => {
  beforeEach(() => window.localStorage.clear());

  it("starts folded, saying what's set, and opens to show the rest", async () => {
    folding(
      <PanelSection title="Menu" value="In the menu">
        <p>Menu label</p>
      </PanelSection>,
    );

    const row = screen.getByRole("button", { name: /Menu/ });
    expect(row).toHaveAttribute("aria-expanded", "false");
    expect(row).toHaveTextContent("In the menu");
    expect(screen.getByText("Menu label")).not.toBeVisible();

    await userEvent.click(row);

    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Menu label")).toBeVisible();
    expect(row).not.toHaveTextContent("In the menu");
  });

  it("stays open next time for someone who opened it", async () => {
    const { unmount } = folding(
      <PanelSection title="Search engines">
        <p>Description</p>
      </PanelSection>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Search engines" }));
    unmount();

    folding(
      <PanelSection title="Search engines">
        <p>Description</p>
      </PanelSection>,
    );

    expect(screen.getByText("Description")).toBeVisible();
  });

  it("opens by itself when something inside needs attention", () => {
    folding(
      <PanelSection title="Review" needsAttention>
        <p>Waiting for you</p>
      </PanelSection>,
    );

    expect(screen.getByText("Waiting for you")).toBeVisible();
  });

  it("never folds what must stay in view", () => {
    folding(
      <PanelSection title="Status" isAlwaysOpen>
        <p>Live</p>
      </PanelSection>,
    );

    expect(screen.getByText("Live")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Status" })).not.toBeInTheDocument();
  });

  it("is a plain section outside the panel", () => {
    render(
      <PanelSection title="History">
        <p>Today</p>
      </PanelSection>,
    );

    expect(screen.getByText("Today")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
