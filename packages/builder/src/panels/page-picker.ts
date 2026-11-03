import { createContext, useContext, useEffect, useState } from "react";

/**
 * A page of the site, picked to link to. Links store the page itself
 * (`pageLinkHref(id)` from builder-model), so they follow it when its address changes;
 * `url` is its address now, such as "/about".
 */
export interface PickedPage {
  id: string;
  url: string;
  title: string;
}

/** Opens the app's page picker and resolves with the chosen page, or null if closed. */
export type PagePicker = () => Promise<PickedPage | null>;

/** Finds a linked page's title by its id: null when the page no longer exists. */
export type PageFinder = (entryId: string) => Promise<{ title: string } | null>;

/**
 * The app's page picker, given to PageBuilder as `pickPage`. Link inputs read it from here
 * rather than through every panel, and offer "Choose a page…" when there is one.
 */
export const PagePickerContext = createContext<PagePicker | undefined>(undefined);

/** The app's page finder, given to PageBuilder as `findPage`, to show linked pages' titles. */
export const PageFinderContext = createContext<PageFinder | undefined>(undefined);

export function usePickPage(): PagePicker | undefined {
  return useContext(PagePickerContext);
}

export type LinkedPageState =
  | { state: "finding" }
  | { state: "found"; title: string }
  | { state: "gone" }
  | { state: "unknown" };

/** What a link to a page by its id should show: the page's title, or that it is gone. */
export function useLinkedPage(entryId: string | null): LinkedPageState {
  const findPage = useContext(PageFinderContext);
  const [found, setFound] = useState<{ entryId: string; result: LinkedPageState } | null>(null);

  useEffect(() => {
    if (!entryId || !findPage) return;
    let isCurrent = true;
    findPage(entryId)
      .then((page): LinkedPageState =>
        page ? { state: "found", title: page.title } : { state: "gone" },
      )
      .catch((): LinkedPageState => ({ state: "unknown" }))
      .then((result) => {
        if (isCurrent) setFound({ entryId, result });
      });
    return () => {
      isCurrent = false;
    };
  }, [entryId, findPage]);

  if (!findPage) return { state: "unknown" };
  return found?.entryId === entryId ? found.result : { state: "finding" };
}
