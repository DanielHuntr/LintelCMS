import { type MarkChange, type TextMark } from "@lintel/builder-model";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { isToggleOn, toggleChange } from "./markToggles.js";
import { TextStyleBar } from "./TextStyleBar.js";

function renderBar(marks: TextMark[] = [], linkRequest = 0) {
  const onApply = vi.fn<(styles: MarkChange | null, label: string) => void>();
  const view = render(
    <TextStyleBar
      from={0}
      to={5}
      marks={marks}
      pageFonts={[]}
      onApply={onApply}
      linkRequest={linkRequest}
    />,
  );
  return { onApply, view };
}

describe("styling selected words", () => {
  it("turns bold on, and off again when it's all on", () => {
    expect(toggleChange([], 0, 5, "bold")).toEqual({ fontWeight: "700" });
    const bold: TextMark[] = [{ from: 0, to: 5, styles: { fontWeight: "700" } }];
    expect(isToggleOn(bold, 0, 5, "bold")).toBe(true);
    expect(toggleChange(bold, 0, 5, "bold")).toEqual({ fontWeight: undefined });
    expect(isToggleOn(bold, 0, 7, "bold")).toBe(false);
  });

  // The text style bar had no way to make words a link.
  it("makes the words a link from an address typed in", async () => {
    const { onApply } = renderBar();

    await userEvent.click(screen.getByRole("button", { name: "Link" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Link to" }), "/contact{Enter}");

    expect(onApply).toHaveBeenCalledWith({ href: "/contact" }, "Link");
  });

  it("refuses an address that could run a script", async () => {
    const { onApply } = renderBar();

    await userEvent.click(screen.getByRole("button", { name: "Link" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Link to" }), "javascript:x{Enter}");

    expect(screen.getByRole("alert")).toHaveTextContent("Use a page address like /contact");
    expect(onApply).not.toHaveBeenCalled();
  });

  it("takes a link off words that are one", async () => {
    const { onApply } = renderBar([{ from: 0, to: 5, styles: {}, href: "/menu" }]);

    const button = screen.getByRole("button", { name: "Remove link" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(button);

    expect(onApply).toHaveBeenCalledWith({ href: undefined }, "Remove link");
  });

  it("opens the address box when Mod+K asks", () => {
    const { view } = renderBar([], 0);
    expect(screen.queryByRole("textbox", { name: "Link to" })).not.toBeInTheDocument();

    view.rerender(
      <TextStyleBar from={0} to={5} marks={[]} pageFonts={[]} onApply={vi.fn()} linkRequest={1} />,
    );

    expect(screen.getByRole("textbox", { name: "Link to" })).toHaveFocus();
  });
});
