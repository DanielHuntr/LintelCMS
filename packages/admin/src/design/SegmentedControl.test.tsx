import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { SegmentedControl } from "./SegmentedControl.js";

type View = "all" | "open" | "shipped";

const views = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "shipped", label: "Shipped" },
] as const;

function OrderViewPicker() {
  const [view, setView] = useState<View>("all");
  return <SegmentedControl label="Show orders" options={views} value={view} onChange={setView} />;
}

function selectedOption() {
  return screen.getByRole("radio", { checked: true });
}

describe("SegmentedControl", () => {
  it("is a labelled radio group with the current choice checked", () => {
    render(<OrderViewPicker />);

    expect(screen.getByRole("radiogroup", { name: "Show orders" })).toBeInTheDocument();
    expect(selectedOption()).toHaveAccessibleName("All");
  });

  it("is a single tab stop: Tab lands on the selected option", async () => {
    render(<OrderViewPicker />);

    await userEvent.tab();

    expect(screen.getByRole("radio", { name: "All" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Open" })).toHaveAttribute("tabindex", "-1");
  });

  it("moves the selection and focus with the arrow keys, wrapping at the ends", async () => {
    render(<OrderViewPicker />);
    await userEvent.tab();

    await userEvent.keyboard("{ArrowRight}");
    expect(selectedOption()).toHaveAccessibleName("Open");
    expect(selectedOption()).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(selectedOption()).toHaveAccessibleName("All");

    await userEvent.keyboard("{ArrowLeft}");
    expect(selectedOption()).toHaveAccessibleName("Shipped");
  });

  it("jumps to the first and last options with Home and End", async () => {
    render(<OrderViewPicker />);
    await userEvent.tab();

    await userEvent.keyboard("{End}");
    expect(selectedOption()).toHaveAccessibleName("Shipped");

    await userEvent.keyboard("{Home}");
    expect(selectedOption()).toHaveAccessibleName("All");
  });

  it("selects an option when it is clicked", async () => {
    render(<OrderViewPicker />);

    await userEvent.click(screen.getByRole("radio", { name: "Shipped" }));

    expect(selectedOption()).toHaveAccessibleName("Shipped");
  });
});
