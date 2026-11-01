import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { AddFieldDialog } from "./AddFieldDialog.js";

const fieldtype = (type: string, name: string, category: string, keywords: string[] = []) => ({
  type,
  name,
  category,
  keywords,
  description: `About ${name}.`,
  holdsValue: true,
  canBeInside: true,
});

const fieldtypes = [
  fieldtype("text", "Text", "text", ["input"]),
  fieldtype("richText", "Rich text", "text", ["wysiwyg"]),
  fieldtype("number", "Number", "choices"),
  fieldtype("select", "Select", "choices", ["dropdown"]),
  fieldtype("radio", "Radio buttons", "choices"),
  fieldtype("date", "Date", "dates"),
];

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

async function openPicker() {
  mockApi(() => ({ fieldtypes }));
  const onPick = vi.fn();
  renderScreen(<AddFieldDialog open onClose={() => undefined} onPick={onPick} />);
  const search = await screen.findByRole("combobox", { name: /Search fields/ });
  await waitFor(() => expect(search).toHaveFocus());
  return { search, onPick };
}

describe("AddFieldDialog", () => {
  it("lists one category at a time, chosen from the rail", async () => {
    await openPicker();
    const grid = screen.getByRole("listbox", { name: "Text & writing" });
    expect(
      within(grid)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["TextAbout Text.", "Rich textAbout Rich text."]);
    await userEvent.click(screen.getByRole("button", { name: /Numbers & choices/ }));
    expect(screen.getByRole("listbox", { name: "Numbers & choices" })).toBeInTheDocument();
  });

  it("finds a fieldtype by another word for it, and adds it with Return", async () => {
    const { search, onPick } = await openPicker();
    await userEvent.type(search, "dropdown");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "SelectAbout Select.",
    ]);
    await userEvent.keyboard("{Enter}");
    expect(onPick).toHaveBeenCalledWith("select", "Select");
  });

  it("moves the highlight with the arrow keys", async () => {
    const { onPick } = await openPicker();
    await userEvent.click(screen.getByRole("button", { name: /Numbers & choices/ }));
    screen.getByRole("combobox").focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    const highlighted = screen.getByRole("option", { selected: true });
    expect(highlighted).toHaveTextContent("Radio buttons");
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-activedescendant", highlighted.id);
    await userEvent.keyboard("{Enter}");
    expect(onPick).toHaveBeenCalledWith("radio", "Radio buttons");
  });

  it("shows recently used fieldtypes first", async () => {
    window.localStorage.setItem("lintel.recentFieldtypes", JSON.stringify(["date", "select"]));
    await openPicker();
    const grid = screen.getByRole("listbox", { name: "Recently used" });
    expect(
      within(grid)
        .getAllByRole("option")
        .map((option) => option.id.split("-").at(-1)),
    ).toEqual(["date", "select"]);
  });
});
