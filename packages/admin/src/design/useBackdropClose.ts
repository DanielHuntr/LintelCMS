import { useRef, type MouseEvent, type PointerEvent } from "react";

/**
 * Closes a `<dialog>` when the dimmed page around it is clicked. Both the press and the
 * release have to be on the backdrop: selecting text in a field and letting go outside the
 * panel ends with a click on the dialog element too, and used to close it, losing what was
 * in it, such as a new API token's one-time secret (LINTEL-FUNC-025).
 */
export function useBackdropClose(onClose: () => void, enabled = true) {
  const pressedOnBackdrop = useRef(false);
  return {
    onPointerDown: (event: PointerEvent<HTMLDialogElement>) => {
      pressedOnBackdrop.current = event.target === event.currentTarget;
    },
    onClick: (event: MouseEvent<HTMLDialogElement>) => {
      const startedOnBackdrop = pressedOnBackdrop.current;
      pressedOnBackdrop.current = false;
      if (enabled && startedOnBackdrop && event.target === event.currentTarget) onClose();
    },
  };
}
