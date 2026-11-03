import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog.js";

function renderDialog() {
  const onClose = vi.fn();
  render(
    <Dialog open onClose={onClose} title="New API token">
      <input aria-label="Secret" defaultValue="lintel_abc123" />
    </Dialog>,
  );
  return { onClose, dialog: screen.getByRole("dialog"), field: screen.getByLabelText("Secret") };
}

describe("Dialog", () => {
  it("closes when the dimmed page around it is clicked", () => {
    const { onClose, dialog } = renderDialog();
    fireEvent.pointerDown(dialog);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // LINTEL-FUNC-025: selecting text and letting go outside the panel closed the dialog.
  it("stays open when a press inside ends on the dimmed page", () => {
    const { onClose, dialog, field } = renderDialog();
    fireEvent.pointerDown(field);
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
  });
});
