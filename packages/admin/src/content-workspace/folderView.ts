import { useEffect, useState } from "react";

/**
 * How a page tree's folder opens in the workspace: "tree" (the pages are in the tree on the
 * left) or "list" (every page in a table, to search, filter and act on many at once).
 * Remembered per folder in this browser.
 */
export type FolderView = "tree" | "list";

export function readFolderView(saved: string | null): FolderView {
  return saved === "list" ? "list" : "tree";
}

export function useFolderView(folderKey: string): [FolderView, (view: FolderView) => void] {
  const storageKey = `lintel.folderView.${folderKey}`;
  const [view, setView] = useState<FolderView>(() => readFolderView(readStorage(storageKey)));
  const [loadedKey, setLoadedKey] = useState(storageKey);
  // Another folder: its own choice. Adjusted during render.
  if (loadedKey !== storageKey) {
    setLoadedKey(storageKey);
    setView(readFolderView(readStorage(storageKey)));
  }
  useEffect(() => {
    writeStorage(storageKey, view);
  }, [storageKey, view]);
  // "Show as list" from the tree's menu, while the folder is open.
  useEffect(() => {
    const follow = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; view: FolderView }>).detail;
      if (detail.key === storageKey) setView(detail.view);
    };
    window.addEventListener(folderViewEvent, follow);
    return () => window.removeEventListener(folderViewEvent, follow);
  }, [storageKey]);
  return [view, setView];
}

const folderViewEvent = "lintel:folder-view";

/** Opens a folder as a list (or the tree) next time, and now if it is open. */
export function rememberFolderView(folderKey: string, view: FolderView): void {
  const key = `lintel.folderView.${folderKey}`;
  writeStorage(key, view);
  window.dispatchEvent(new CustomEvent(folderViewEvent, { detail: { key, view } }));
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private windows can refuse storage; the choice then lasts until the page is left.
  }
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
