import { Button } from "./Button.js";
import { Dialog } from "./Dialog.js";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Destructive actions, such as deleting, show the confirm button in red. */
  isDestructive?: boolean;
  /** Disables the buttons while the action runs. */
  isWorking?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Asks "are you sure?" before something that can't easily be undone. Used instead of the
 * browser's confirm(), which can't be styled, translated by us, or kept in the admin's look.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  isDestructive = false,
  isWorking = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      size="alert"
      title={title}
      description={message}
      footer={
        <>
          {/* Cancel comes first in the tab order, so Enter on open doesn't destroy anything. */}
          <Button variant="tinted" onClick={onCancel} disabled={isWorking} data-autofocus>
            {cancelLabel}
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "filled"}
            onClick={onConfirm}
            disabled={isWorking}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
