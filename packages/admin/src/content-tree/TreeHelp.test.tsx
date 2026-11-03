import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Copy, Pencil, Plus, Send, Trash2, type LucideIcon } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderScreen } from "../testing/renderScreen.js";
import { StatusKey } from "./StatusKey.js";
import { StatusMark, statusLabel } from "./StatusMark.js";
import { TreeActionsMenu, type ActionItem } from "./TreeActionsMenu.js";
import { TreeHint } from "./TreeHint.js";
import { isTreeHintDismissed } from "./treeState.js";

describe("the status marks", () => {
  it.each([
    ["changed", "Changes not published"],
    ["draft", "Draft"],
    ["scheduled", "Scheduled"],
    ["published", "Live"],
  ] as const)("names %s in words, as a tooltip too", (state, words) => {
    render(<StatusMark state={state} />);

    const mark = screen.getByRole("img", { name: words });
    expect(mark).toHaveAttribute("title", words);
  });

  it("says when a scheduled page goes live", () => {
    expect(statusLabel("scheduled", "2026-12-01T09:00:00.000Z")).toMatch(/^Scheduled for .*2026/);
  });

  it("draws a different shape for each state, so colour isn't the only clue", () => {
    const shapes = (["published", "changed", "draft", "scheduled"] as const).map((state) => {
      const { container, unmount } = render(<StatusMark state={state} />);
      const shape = container.querySelector("svg")?.getAttribute("class");
      unmount();
      return shape;
    });

    expect(new Set(shapes).size).toBe(4);
  });
});

describe("the key to the marks", () => {
  it("explains every state, and that live pages have no mark", async () => {
    renderScreen(<StatusKey id="key" />);

    const key = await screen.findByRole("region", { name: "What the marks mean" });
    for (const words of ["Live", "Changes not published", "Draft", "Scheduled"]) {
      expect(within(key).getByText(words)).toBeInTheDocument();
    }
    expect(key).toHaveTextContent("Pages with no mark in the tree are live.");
    expect(within(key).getByRole("link", { name: "How the tree works" })).toHaveAttribute(
      "href",
      "/help?topic=using%2Fcontent-tree",
    );
  });
});

describe("the first-time hint", () => {
  beforeEach(() => window.localStorage.clear());

  it("says why pages sit under Home and what that does to their address", async () => {
    renderScreen(<TreeHint canMovePages />);

    const hint = await screen.findByRole("region", { name: "How your pages fit together" });
    expect(hint).toHaveTextContent("like /work");
    expect(hint).toHaveTextContent("like /blogs/article");
    expect(hint).toHaveTextContent("Drag a page to move it.");
  });

  it("doesn't talk about dragging to someone who can't move pages", async () => {
    renderScreen(<TreeHint canMovePages={false} />);

    const hint = await screen.findByRole("region", { name: "How your pages fit together" });
    expect(hint).not.toHaveTextContent("Drag a page");
  });

  it("stays away once it has been dismissed", async () => {
    renderScreen(<TreeHint canMovePages />);
    await userEvent.click(await screen.findByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();

    expect(isTreeHintDismissed()).toBe(true);
  });
});

function item(
  key: string,
  section: ActionItem["section"],
  icon: LucideIcon = Plus,
  onSelect: () => void = () => undefined,
): ActionItem {
  return { key, label: key, icon, onSelect, section };
}

const menuItems = [
  item("Create…", "make"),
  item("Rename…", "make", Pencil),
  item("Duplicate…", "make", Copy),
  item("Publish…", "publish", Send),
  item("Move…", "more"),
  item("History", "more"),
  item("Delete…", "delete", Trash2),
];

function openMenu(items: readonly ActionItem[] = menuItems, onClose: () => void = () => undefined) {
  render(
    <TreeActionsMenu label="Actions" items={items} position={{ x: 0, y: 0 }} onClose={onClose} />,
  );
  return screen.getByRole("menu", { name: "Actions" });
}

describe("a row's menu", () => {
  it("shows groups with the rarer actions folded under More", () => {
    const menu = openMenu();

    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((row) => row.textContent),
    ).toEqual(["Create…", "Rename…", "Duplicate…", "Publish…", "More", "Delete…"]);
    expect(within(menu).getAllByRole("separator")).toHaveLength(3);
  });

  it("opens More in place, by pointer", async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const menu = openMenu(
      menuItems.map((row) => (row.key === "Move…" ? { ...row, onSelect } : row)),
      onClose,
    );

    await userEvent.click(within(menu).getByRole("menuitem", { name: "More" }));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Move…" }));

    expect(onSelect).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("opens and closes More with the arrow keys, and walks through it", async () => {
    const menu = openMenu();
    const more = within(menu).getByRole("menuitem", { name: "More" });
    more.focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(within(menu).getByRole("menuitem", { name: "Move…" })).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}");
    expect(within(menu).getByRole("menuitem", { name: "History" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(within(menu).getByRole("menuitem", { name: "Delete…" })).toHaveFocus();

    await userEvent.keyboard("{ArrowUp}{ArrowLeft}");
    expect(more).toHaveFocus();
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(within(menu).queryByRole("menuitem", { name: "Move…" })).toBeNull();
  });

  it("doesn't fold a single item away", () => {
    const menu = openMenu([item("Create…", "make"), item("Info", "more")]);

    expect(within(menu).queryByRole("menuitem", { name: "More" })).toBeNull();
    expect(within(menu).getByRole("menuitem", { name: "Info" })).toBeInTheDocument();
  });

  it("stays one plain list where nothing says otherwise", () => {
    const menu = openMenu([
      { key: "a", label: "Create…", icon: Plus, onSelect: () => undefined },
      { key: "b", label: "Show as list", icon: Plus, onSelect: () => undefined },
    ]);

    expect(within(menu).queryAllByRole("separator")).toHaveLength(0);
  });
});
