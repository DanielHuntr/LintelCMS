import { useQuery } from "@tanstack/react-query";
import { FileText, House } from "lucide-react";
import { useId, useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { getCollectionItems } from "../content-tree/contentTree.api.js";
import type { CollectionItem } from "../content-tree/contentTree.types.js";
import { treeKeys } from "../content-tree/contentTree.queries.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { SearchField } from "../design/SearchField.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCurrentSite } from "../sites/SiteContext.js";
import type { PickedPage } from "./menuTree.js";
import type { LinkedEntry } from "./menus.types.js";

/** The most pages the picker lists (a page of 100 at a time). */
const MOST_PAGES = 1000;

/** Every page of the site's page tree, top to bottom, with how deep each sits. */
async function loadPageTree(siteId: string | undefined): Promise<CollectionItem[]> {
  const pages: CollectionItem[] = [];
  for (let page = 1; pages.length < MOST_PAGES; page++) {
    const level = await getCollectionItems(
      { collection: "pages" },
      { allLevels: true, page, perPage: 100, siteId },
    );
    pages.push(...level.items);
    if (pages.length >= level.total || level.items.length === 0) break;
  }
  return pages;
}

function depthsOf(pages: readonly CollectionItem[]): Map<string, number> {
  const parents = new Map(pages.map((page) => [page.id, page.parentId]));
  const depths = new Map<string, number>();
  for (const page of pages) {
    let depth = 0;
    let parent = page.parentId;
    while (parent && parents.has(parent) && depth < 20) {
      depth++;
      parent = parents.get(parent) ?? null;
    }
    depths.set(page.id, depth);
  }
  return depths;
}

interface AddPagesDialogProps {
  menuName: string;
  /** Pages the menu links to already: shown ticked, and left alone. */
  linkedIds: ReadonlySet<string>;
  onAdd: (pages: (PickedPage & { status: LinkedEntry["status"] })[]) => void;
  onClose: () => void;
}

/**
 * "Add pages": the site's pages as an indented tree with a box beside each, to pick as many
 * as wanted at once. Pages already in the menu are ticked and can't be added twice.
 */
export function AddPagesDialog({ menuName, linkedIds, onAdd, onClose }: AddPagesDialogProps) {
  const siteId = useCurrentSite()?.site.id;
  const pages = useQuery({
    queryKey: [...treeKeys.all(), "menu-pages", siteId ?? "main"],
    queryFn: () => loadPageTree(siteId),
  });
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [search, setSearch] = useState("");
  const listId = useId();
  const all = pages.data ?? [];
  const depths = depthsOf(all);
  const query = search.trim().toLowerCase();
  const shown = query === "" ? all : all.filter((page) => page.title.toLowerCase().includes(query));
  const addable = shown.filter((page) => !linkedIds.has(page.id));

  function toggle(id: string, isOn: boolean) {
    const next = new Set(picked);
    if (isOn) next.add(id);
    else next.delete(id);
    setPicked(next);
  }

  function add() {
    const homes = new Set(all.filter((page) => page.isSiteStart).map((page) => page.id));
    onAdd(
      all
        .filter((page) => picked.has(page.id))
        .map((page) => ({
          id: page.id,
          title: page.title,
          status: page.status,
          // The home page's children sit beside it in a menu, not under it.
          parentId: page.parentId !== null && homes.has(page.parentId) ? null : page.parentId,
        })),
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("menus.addPages.title", { name: menuName })}
      description={t("menus.addPages.note")}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={add} disabled={picked.size === 0}>
            {t("menus.addPages.confirm", { count: picked.size })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <SearchField
          label={t("menus.addPages.search")}
          value={search}
          onValueChange={setSearch}
          data-autofocus=""
        />
        {pages.isError && <LoadError error={pages.error} onRetry={() => void pages.refetch()} />}
        {pages.isPending && (
          <LoadingRegion label={t("menus.addPages.loading")}>
            <Skeleton className="h-40 w-full" />
          </LoadingRegion>
        )}
        {pages.data && all.length === 0 && (
          <p className="text-body text-label-secondary">{t("menus.addPages.empty")}</p>
        )}
        {addable.length > 1 && (
          <label className="flex items-center gap-2 px-1 text-footnote text-label-secondary">
            <input
              type="checkbox"
              checked={addable.every((page) => picked.has(page.id))}
              onChange={(event) =>
                setPicked(
                  event.target.checked
                    ? new Set([...picked, ...addable.map((page) => page.id)])
                    : new Set(),
                )
              }
              className="size-4 accent-(--color-accent-fill)"
            />
            {t("menus.addPages.selectAll")}
          </label>
        )}
        <ul
          id={listId}
          className="flex max-h-80 flex-col overflow-y-auto rounded-control bg-fill/40 py-1"
        >
          {shown.map((page) => {
            const isLinked = linkedIds.has(page.id);
            const Icon = page.isSiteStart ? House : FileText;
            return (
              <li key={page.id}>
                <label
                  style={{
                    paddingInlineStart: `${0.75 + (query ? 0 : (depths.get(page.id) ?? 0)) * 1.25}rem`,
                  }}
                  className="flex cursor-pointer items-center gap-2.5 py-1.5 pe-3 text-body text-label hover:bg-fill has-focus-visible:focus-ring-inset has-disabled:cursor-default"
                >
                  <input
                    type="checkbox"
                    checked={isLinked || picked.has(page.id)}
                    disabled={isLinked}
                    onChange={(event) => toggle(page.id, event.target.checked)}
                    className="size-4 shrink-0 accent-(--color-accent-fill)"
                  />
                  <Icon
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-4 shrink-0 text-label-secondary"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {page.title || t("tree.untitled")}
                  </span>
                  {isLinked ? (
                    <span className="shrink-0 text-caption text-label-tertiary">
                      {t("menus.addPages.inMenu")}
                    </span>
                  ) : (
                    page.url && (
                      <span className="shrink-0 font-mono text-caption text-label-tertiary">
                        {page.url}
                      </span>
                    )
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </Dialog>
  );
}
