import { createContext, useContext } from "react";

/** A page of the site, picked to link to: `url` is its address, such as "/about". */
export interface PickedPage {
  url: string;
  title: string;
}

/** Opens the app's page picker and resolves with the chosen page, or null if closed. */
export type PagePicker = () => Promise<PickedPage | null>;

/**
 * The app's page picker, given to PageBuilder as `pickPage`. Link inputs read it from here
 * rather than through every panel, and offer "Choose a page…" when there is one.
 */
export const PagePickerContext = createContext<PagePicker | undefined>(undefined);

export function usePickPage(): PagePicker | undefined {
  return useContext(PagePickerContext);
}
