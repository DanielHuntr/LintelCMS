import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DesignerWhenWide } from "./DesignerWhenWide.js";

function page(isNarrowScreen: boolean) {
  return (
    <DesignerWhenWide isNarrowScreen={isNarrowScreen} note={<p>Needs a bigger screen</p>}>
      <textarea aria-label="Code" />
    </DesignerWhenWide>
  );
}

describe("the designer on narrow screens", () => {
  it("doesn't start the designer in a window that is already narrow", () => {
    render(page(true));

    expect(screen.getByText("Needs a bigger screen")).toBeInTheDocument();
    expect(screen.queryByLabelText("Code")).not.toBeInTheDocument();
  });

  it("keeps what is being written when the window narrows and widens", async () => {
    const user = userEvent.setup();
    const { rerender } = render(page(false));
    await user.type(screen.getByLabelText("Code"), "void main");

    rerender(page(true));
    expect(screen.getByText("Needs a bigger screen")).toBeInTheDocument();
    expect(screen.getByLabelText("Code").parentElement).toHaveClass("hidden");

    rerender(page(false));
    expect(screen.queryByText("Needs a bigger screen")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Code")).toHaveValue("void main");
    expect(screen.getByLabelText("Code").parentElement).not.toHaveClass("hidden");
  });

  it("opens the designer once the window is wide enough", () => {
    const { rerender } = render(page(true));

    rerender(page(false));

    expect(screen.getByLabelText("Code")).toBeInTheDocument();
  });
});
