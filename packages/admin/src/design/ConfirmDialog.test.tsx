import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog.js";

function renderConfirm() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      open
      title="Delete “About”?"
      message="This can’t be undone."
      confirmLabel="Delete"
      cancelLabel="Cancel"
      isDestructive
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  it("is an alert dialog named by its question and described by its message", () => {
    renderConfirm();

    const dialog = screen.getByRole("alertdialog", { name: "Delete “About”?" });
    expect(dialog).toHaveAccessibleDescription("This can’t be undone.");
  });

  it("starts on Cancel, so pressing Enter straight away is safe", async () => {
    const { onConfirm, onCancel } = renderConfirm();

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirms with its confirm button", async () => {
    const { onConfirm } = renderConfirm();

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
