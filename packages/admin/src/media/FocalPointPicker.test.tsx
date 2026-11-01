import type { FocalPoint } from "@lintel/core/media-crop";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { FocalPointPicker } from "./FocalPointPicker.js";

function renderPicker(start: FocalPoint) {
  const onCommit = vi.fn();
  function Harness() {
    const [value, setValue] = useState(start);
    return (
      <FocalPointPicker
        imageUrl="http://localhost:4000/media/1/file"
        aspectRatio={1.6}
        value={value}
        onChange={setValue}
        onCommit={onCommit}
      />
    );
  }
  render(<Harness />);
  return { picker: screen.getByRole("application", { name: "Focal point" }), onCommit };
}

describe("FocalPointPicker", () => {
  it("nudges the point with the arrow keys, further with Shift", async () => {
    const { picker, onCommit } = renderPicker({ x: 0.5, y: 0.5 });
    picker.focus();

    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowUp}");
    expect(onCommit).toHaveBeenLastCalledWith({ x: 0.52, y: 0.49 });

    await userEvent.keyboard("{Shift>}{ArrowDown}{ArrowLeft}{/Shift}");
    expect(onCommit).toHaveBeenLastCalledWith({ x: 0.42, y: 0.59 });
    expect(picker).toHaveAccessibleDescription(/Click or drag on the image.*42% across, 59% down/);
  });

  it("stops at the edges of the image", async () => {
    const { picker, onCommit } = renderPicker({ x: 0.95, y: 0.02 });
    picker.focus();

    await userEvent.keyboard("{Shift>}{ArrowRight}{ArrowUp}{/Shift}");

    expect(onCommit).toHaveBeenLastCalledWith({ x: 1, y: 0 });
  });
});
