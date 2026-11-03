import { useCallback, useRef, useState } from "react";
import type { PickedPage } from "./pageLinks.queries.js";
import { PagePickerDialog } from "./PagePickerDialog.js";

/**
 * The page picker as a promise, for the page builder, which asks the admin for a page the
 * way it asks for a picture: `pick()` opens it and resolves with the page, or null when
 * closed. Render `dialog` somewhere on the screen.
 */
export function usePagePicker() {
  const [isOpen, setIsOpen] = useState(false);
  const resolver = useRef<((page: PickedPage | null) => void) | null>(null);

  const finish = (page: PickedPage | null) => {
    resolver.current?.(page);
    resolver.current = null;
    setIsOpen(false);
  };

  const pick = useCallback(() => {
    setIsOpen(true);
    return new Promise<PickedPage | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  return {
    pick,
    dialog: (
      <PagePickerDialog
        open={isOpen}
        onClose={() => finish(null)}
        onChoose={(page) => finish(page)}
      />
    ),
  };
}
