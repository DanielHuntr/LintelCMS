import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { fetchLinkedPage, type PickedPage } from "./pageLinks.queries.js";
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

/**
 * For the page builder: a linked page's title by its id, or null when the page no longer
 * exists, so its link inputs show "About" rather than the stored reference.
 */
export function usePageFinder() {
  const queryClient = useQueryClient();
  return useCallback((entryId: string) => fetchLinkedPage(queryClient, entryId), [queryClient]);
}
