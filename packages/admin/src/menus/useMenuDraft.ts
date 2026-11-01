import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, type FieldMessages } from "../api/client.js";
import { describeError } from "../api/describeError.js";
import { isSameValue } from "../content/sameValue.js";
import { t } from "../i18n/strings.js";
import { menuItemLabel } from "./MenuItemRow.js";
import {
  addPageItems,
  buildMenu,
  type FlatMenuItem,
  flattenMenu,
  type PickedPage,
} from "./menuTree.js";
import { saveMenu } from "./menus.api.js";
import { menuKeys } from "./menus.queries.js";
import type { LinkedEntry, Menu, MenuSource, PageTreeSettings } from "./menus.types.js";

/**
 * A menu being edited, for the Menus screen and the page builder alike: its items (or, when
 * it follows the page tree, what it hides and renames), what has changed since the last
 * save, and saving. Every save goes to the same menu, so both places always agree.
 */
export function useMenuDraft(menu: Menu) {
  const queryClient = useQueryClient();
  const [source, setSource] = useState<MenuSource>(menu.source);
  const [maxDepth, setMaxDepth] = useState(menu.maxDepth);
  const [saved, setSaved] = useState(() => flattenMenu(menu.items));
  const [items, setItems] = useState(saved);
  const [savedTree, setSavedTree] = useState(menu.pageTree);
  const [pageTree, setPageTree] = useState(menu.pageTree);
  const [linkedEntries, setLinkedEntries] = useState<Record<string, LinkedEntry>>(
    menu.linkedEntries,
  );
  const [problems, setProblems] = useState<FieldMessages>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const isUnsaved =
    source === "pageTree" ? !isSameValue(savedTree, pageTree) : !isSameValue(saved, items);

  /** Takes in a menu the API answered with, as the new saved state. */
  function adopt(updated: Menu) {
    queryClient.setQueryData(menuKeys.menu(menu.handle), updated);
    void queryClient.invalidateQueries({ queryKey: menuKeys.menus() });
    // "In the main menu" on pages reads the same menu.
    void queryClient.invalidateQueries({ queryKey: ["menus", menu.handle, "pages"] });
    const fresh = flattenMenu(updated.items);
    setSource(updated.source);
    setMaxDepth(updated.maxDepth);
    setSaved(fresh);
    setItems(fresh);
    setSavedTree(updated.pageTree);
    setPageTree(updated.pageTree);
    setLinkedEntries(updated.linkedEntries);
    setProblems({});
  }

  async function send(changes: Parameters<typeof saveMenu>[1]): Promise<boolean> {
    setIsSaving(true);
    setSaveError(null);
    try {
      adopt(await saveMenu(menu.handle, changes));
      return true;
    } catch (error) {
      setProblems(error instanceof ApiError ? (error.fields ?? {}) : {});
      setSaveError(describeError(error));
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  function change(next: FlatMenuItem[], movedId?: string) {
    setItems(next);
    const index = movedId ? next.findIndex((item) => item.id === movedId) : -1;
    const moved = next[index];
    if (moved) {
      setAnnouncement(
        t("menus.moved", {
          label: menuItemLabel(moved, linkedEntries[moved.entryId ?? ""]),
          position: index + 1,
          count: next.length,
          level: moved.depth + 1,
        }),
      );
    }
  }

  function addPages(pages: readonly (PickedPage & { status: LinkedEntry["status"] })[]) {
    setLinkedEntries((current) => ({
      ...current,
      ...Object.fromEntries(
        pages.map((page) => [
          page.id,
          { title: page.title, collectionHandle: "pages", status: page.status },
        ]),
      ),
    }));
    change(addPageItems(items, pages, maxDepth));
  }

  return {
    handle: menu.handle,
    source,
    maxDepth,
    setMaxDepth,
    items,
    change,
    setItems,
    pageTree,
    setPageTree: (next: PageTreeSettings) => setPageTree(next),
    linkedEntries,
    setLinkedEntries,
    problems,
    saveError,
    isSaving,
    isUnsaved,
    announcement,
    addPages,
    adopt,
    save: () => (source === "pageTree" ? send({ pageTree }) : send({ items: buildMenu(items) })),
    /**
     * Follow the page tree (keeping the hand-made items, and any not yet saved), or arrange
     * it by hand, starting from the pages it shows now.
     */
    switchSource: (next: MenuSource) =>
      next === "pageTree"
        ? send({ source: "pageTree", items: buildMenu(items) })
        : send({ source: "items", items: buildMenu(items) }),
  };
}

export type MenuDraft = ReturnType<typeof useMenuDraft>;
