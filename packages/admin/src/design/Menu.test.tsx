import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Menu } from "./Menu.js";

function renderMenu() {
  const duplicate = vi.fn();
  const remove = vi.fn();
  render(
    <Menu
      label="More actions"
      trigger="…"
      items={[
        { label: "Duplicate", onSelect: duplicate },
        { label: "Delete", tone: "danger", onSelect: remove },
      ]}
    />,
  );
  return { duplicate, remove };
}

describe("Menu", () => {
  it("opens from its button with focus on the first item", async () => {
    renderMenu();
    const button = screen.getByRole("button", { name: "More actions" });

    await userEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toHaveFocus();
  });

  it("moves with the arrow keys, wrapping round, and runs the chosen item", async () => {
    const { remove } = renderMenu();
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toHaveFocus();

    await userEvent.keyboard("{ArrowUp}{Enter}");
    expect(remove).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes with Escape and gives focus back to its button", async () => {
    renderMenu();
    const button = screen.getByRole("button", { name: "More actions" });
    await userEvent.click(button);

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });
});
