import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MediaPicker } from "./MediaPicker.js";
import { makeAsset, mockApi, renderWithQueries } from "./media.test-helpers.js";

const harbour = makeAsset({ id: "aaaaaaaa-0000-4000-8000-000000000001", filename: "harbour.jpg" });
const lighthouse = makeAsset({
  id: "aaaaaaaa-0000-4000-8000-000000000002",
  filename: "lighthouse.jpg",
  alt: "A white lighthouse at dusk",
});

function serveLibrary() {
  return mockApi((path) => {
    if (path.startsWith("/media?")) return { assets: [harbour, lighthouse], total: 2 };
    if (path === `/media/${lighthouse.id}`) return lighthouse;
    if (path === `/media/${harbour.id}`) return harbour;
    throw new Error(`Unexpected request: ${path}`);
  });
}

afterEach(() => vi.restoreAllMocks());

describe("MediaPicker", () => {
  it("chooses an image from the library", async () => {
    const requested = serveLibrary();
    const onChange = vi.fn();
    renderWithQueries(<MediaPicker value={null} onChange={onChange} label="Hero image" />);

    await userEvent.click(screen.getByRole("button", { name: "Choose image" }));
    const dialog = screen.getByRole("dialog", { name: "Choose an image" });
    await userEvent.click(await within(dialog).findByRole("button", { name: /lighthouse\.jpg/ }));

    expect(onChange).toHaveBeenCalledWith(lighthouse.id);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // The picker only offers images.
    expect(requested.some((path) => path.includes("type=image"))).toBe(true);
  });

  it("shows the chosen image, and Remove clears it", async () => {
    serveLibrary();
    const onChange = vi.fn();
    renderWithQueries(<MediaPicker value={lighthouse.id} onChange={onChange} label="Hero image" />);

    const field = screen.getByRole("group", { name: "Hero image" });
    expect(await within(field).findByText("lighthouse.jpg")).toBeInTheDocument();
    expect(
      within(field).getByRole("img", { name: "A white lighthouse at dusk" }),
    ).toBeInTheDocument();
    await userEvent.click(within(field).getByRole("button", { name: "Remove" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("works from the keyboard: arrows move through the grid, Enter chooses, Escape closes", async () => {
    serveLibrary();
    const onChange = vi.fn();
    renderWithQueries(<MediaPicker value={harbour.id} onChange={onChange} label="Hero image" />);

    const replace = await screen.findByRole("button", { name: "Replace" });
    await userEvent.click(replace);
    const dialog = screen.getByRole("dialog");
    // Search has focus first, so people can type straight away.
    expect(within(dialog).getByRole("searchbox", { name: "Search" })).toHaveFocus();

    const firstTile = await within(dialog).findByRole("button", { name: /harbour\.jpg/ });
    expect(firstTile).toHaveAttribute("aria-current", "true");
    firstTile.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(within(dialog).getByRole("button", { name: /lighthouse\.jpg/ })).toHaveFocus();
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(replace).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.click(replace);
    const reopened = await within(screen.getByRole("dialog")).findByRole("button", {
      name: /lighthouse\.jpg/,
    });
    reopened.focus();
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(lighthouse.id);
  });

  it("keeps Tab inside the dialog", async () => {
    serveLibrary();
    renderWithQueries(<MediaPicker value={null} onChange={vi.fn()} label="Hero image" />);

    await userEvent.click(screen.getByRole("button", { name: "Choose image" }));
    const dialog = screen.getByRole("dialog");
    await within(dialog).findByRole("button", { name: /harbour\.jpg/ });
    for (let press = 0; press < 8; press += 1) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await waitFor(() => expect(dialog).toBeInTheDocument());
  });
});
