import type { ComponentCatalogue, CustomBlock, SectionTemplate } from "@lintel/builder-model";
import { Search } from "lucide-react";
import {
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { blockInsertItems } from "../blocks/block-commands.js";
import { useBuilderText } from "../i18n/builder-text.js";
import { usePreference, usePreferenceStore } from "../preferences/builder-preferences.js";
import { useRememberedOpenSections } from "../preferences/open-sections.js";
import { CollapsibleSection } from "../ui/CollapsibleSection.js";
import { classNames } from "../ui/classNames.js";
import { ChoiceGroup, inputClassName } from "../ui/controls.js";
import { insertGroupIcons } from "./insert-group-icons.js";
import {
  groupInsertItems,
  type InsertItem,
  type InsertKey,
  type InsertKind,
  insertItems,
  isTemplateAvailable,
  readRecentlyUsed,
  searchInsertItems,
  withRecentlyUsed,
} from "./insert-library.js";
import { InsertTile } from "./InsertTile.js";
import { insertDragType } from "./layer-drop.js";

export type { InsertKey } from "./insert-library.js";

interface InsertPanelProps {
  catalogue: ComponentCatalogue;
  templates: readonly SectionTemplate[];
  canEditCode: boolean;
  /** Elements that belong to a plugin are only offered while it is on. All, when left out. */
  enabledPlugins?: readonly string[];
  /** The site's own blocks, listed first under "Your site's blocks". */
  blocks?: readonly CustomBlock[];
  onInsert: (key: InsertKey) => void;
  /** What is being dragged from here (null when the drag ends), for dropping on the canvas. */
  onDragChange?: (item: InsertItem | null) => void;
  /**
   * Opens a segment with the search focused, as the empty page's buttons do. A new `count`
   * asks again, even for the same segment.
   */
  focusRequest?: InsertFocusRequest;
  /** "Draft a page for me", shown above the sections when page drafting is on. */
  draftButton?: ReactNode;
}

export interface InsertFocusRequest {
  kind: InsertKind;
  count: number;
}

const recentShown: Record<InsertKind, number> = { sections: 2, elements: 4 };

const kindTitles = {
  sections: "pageBuilder.insert.kindSections",
  elements: "pageBuilder.insert.kindElements",
} as const;

/**
 * The library: ready-made sections (the default) and single elements, each by group, a
 * search across both, and what was used recently. Section groups start closed, so the list
 * is short: ten groups by purpose, each with how many it holds. Press an
 * item to add it after the selected element (or inside it, when it holds elements), or drag
 * it into Layers to put it exactly where you want.
 */
export function InsertPanel({
  catalogue,
  templates,
  canEditCode,
  enabledPlugins,
  blocks,
  onInsert,
  onDragChange,
  focusRequest,
  draftButton,
}: InsertPanelProps) {
  const text = useBuilderText();
  const store = usePreferenceStore();
  const searchId = useId();
  const list = useRef<HTMLDivElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [kind, setKind] = usePreference<InsertKind>(store, "insert.kind", (stored) =>
    stored === "elements" ? "elements" : "sections",
  );
  const [recent, setRecent] = useState(() => readRecentlyUsed(store.read("insert.recent")));

  const items = useMemo(() => {
    const library = insertItems(
      templates.filter((template) =>
        isTemplateAvailable(template.blueprint, catalogue, enabledPlugins),
      ),
      catalogue.definitions.filter(
        (definition) =>
          !definition.hiddenFromInsert &&
          (canEditCode || !definition.requiresCodePermission) &&
          (!definition.requiresPlugin ||
            !enabledPlugins ||
            enabledPlugins.includes(definition.requiresPlugin)),
      ),
    );
    // The site's own blocks go first in their group, before the ready-made ones.
    const firstElement = library.findIndex((item) => item.kind === "elements");
    const at = firstElement === -1 ? library.length : firstElement;
    return [...library.slice(0, at), ...blockInsertItems(blocks ?? []), ...library.slice(at)];
  }, [templates, catalogue, canEditCode, enabledPlugins, blocks]);
  const sectionGroups = useMemo(() => groupInsertItems(items, "sections"), [items]);
  const elementGroups = useMemo(() => groupInsertItems(items, "elements"), [items]);
  const groups = kind === "sections" ? sectionGroups : elementGroups;
  const results = useMemo(
    () => searchInsertItems(items, search, (key) => text(key)),
    [items, search, text],
  );
  const recentItems = recent
    .map((key) => items.find((item) => item.key === key))
    .filter((item): item is InsertItem => item?.kind === kind)
    .slice(0, recentShown[kind]);
  // Section groups start closed; element groups with only the first open. After that,
  // whatever was left open.
  const openSectionGroups = useRememberedOpenSections(store, "insert.sectionGroups.open", []);
  const openElementGroups = useRememberedOpenSections(
    store,
    "insert.elements.open",
    elementGroups.slice(0, 1).map((group) => group.id),
  );
  const openGroups = kind === "sections" ? openSectionGroups : openElementGroups;

  // A new request starts from an empty search, on the segment asked for.
  const [answeredRequest, setAnsweredRequest] = useState(focusRequest);
  if (focusRequest !== answeredRequest) {
    setAnsweredRequest(focusRequest);
    setSearch("");
  }
  useEffect(() => {
    if (!focusRequest) return;
    setKind(focusRequest.kind);
    searchBox.current?.focus();
  }, [focusRequest, setKind]);

  const remember = (key: InsertKey) => {
    const next = withRecentlyUsed(recent, key);
    setRecent(next);
    store.write("insert.recent", next.join(","));
  };
  const insert = (key: InsertKey) => {
    remember(key);
    onInsert(key);
  };
  const startDrag = (event: DragEvent, item: InsertItem) => {
    event.dataTransfer.setData(insertDragType, item.key);
    event.dataTransfer.setData(`${insertDragType}+${item.type.toLowerCase()}`, "");
    event.dataTransfer.effectAllowed = "copy";
    onDragChange?.(item);
  };
  const endDrag = (event: DragEvent, item: InsertItem) => {
    if (event.dataTransfer.dropEffect !== "none") remember(item.key);
    onDragChange?.(null);
  };

  const handleSearchKeys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && search !== "") {
      event.stopPropagation();
      setSearch("");
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      list.current?.querySelector<HTMLButtonElement>("[data-insert-tile]")?.focus();
    }
  };

  // Sections and elements get a row each, so every name fits in full at the panel's width.
  const columns = { compact: 4, element: 1, section: 1 } as const;
  const tiles = (shown: readonly InsertItem[], look: "section" | "element" | "compact") => (
    <ul className={classNames("grid gap-1", look === "compact" ? "grid-cols-4" : "grid-cols-1")}>
      {shown.map((item, index) => (
        <li key={item.key} className="min-w-0">
          <InsertTile
            item={item}
            look={look}
            align={isLeftHalf(index, columns[look]) ? "start" : "end"}
            onInsert={insert}
            onDragStart={startDrag}
            onDragEnd={endDrag}
          />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex flex-col gap-2 bg-surface px-3 pt-3 pb-3 hairline-bottom">
        <div className="relative">
          <label htmlFor={searchId} className="sr-only">
            {text("pageBuilder.insert.searchLabel")}
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 inset-s-2 size-3.5 -translate-y-1/2 text-label-tertiary"
          />
          <input
            ref={searchBox}
            id={searchId}
            type="search"
            value={search}
            placeholder={text("pageBuilder.insert.searchLabel")}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={handleSearchKeys}
            className={classNames(inputClassName, "ps-7")}
          />
        </div>
        {search.trim() === "" && (
          <ChoiceGroup<InsertKind>
            label={text("pageBuilder.insert.kindLabel")}
            hideLabel
            value={kind}
            onChange={setKind}
            choices={[
              { value: "sections", label: text("pageBuilder.insert.kindSections") },
              { value: "elements", label: text("pageBuilder.insert.kindElements") },
            ]}
          />
        )}
        {search.trim() === "" && kind === "sections" && draftButton}
      </div>

      <div ref={list} className="flex flex-col gap-1 px-2 py-2">
        {search.trim() !== "" ? (
          <SearchResults
            results={results}
            search={search.trim()}
            render={(shown, kindShown) =>
              tiles(shown, kindShown === "sections" ? "section" : "element")
            }
          />
        ) : (
          <>
            {recentItems.length > 0 && (
              <section aria-labelledby={`${searchId}-recent`} className="flex flex-col gap-1 pb-1">
                <h3
                  id={`${searchId}-recent`}
                  className="px-1.5 pt-1 text-caption font-semibold tracking-wide text-label-secondary uppercase"
                >
                  {text("pageBuilder.insert.recent")}
                </h3>
                {tiles(recentItems, kind === "sections" ? "section" : "compact")}
              </section>
            )}
            {groups.map((group) => (
              <CollapsibleSection
                key={group.id}
                variant="group"
                title={text(group.title)}
                icon={insertGroupIcons[group.id]}
                summary={String(group.items.length)}
                isOpen={openGroups.isOpen(group.id)}
                onToggle={() => openGroups.toggle(group.id)}
              >
                {tiles(group.items, kind === "sections" ? "section" : "element")}
              </CollapsibleSection>
            ))}
          </>
        )}
      </div>
      <p className="px-4 pt-1 pb-4 text-caption text-label-tertiary">
        {text("pageBuilder.insert.hint")}
      </p>
    </div>
  );
}

function SearchResults({
  results,
  search,
  render,
}: {
  results: readonly InsertItem[];
  search: string;
  render: (items: readonly InsertItem[], kind: InsertKind) => ReactNode;
}) {
  const text = useBuilderText();
  // The kind with the best match comes first: "heading" shows elements, "hero" sections.
  const kinds: InsertKind[] =
    results[0]?.kind === "elements" ? ["elements", "sections"] : ["sections", "elements"];
  return (
    <>
      <p role="status" className="sr-only">
        {results.length === 0
          ? text("pageBuilder.insert.noResults", { search })
          : text("pageBuilder.insert.resultCount", { count: results.length })}
      </p>
      {results.length === 0 && (
        <p className="px-2 py-6 text-center text-footnote text-label-secondary">
          {text("pageBuilder.insert.noResults", { search })}
        </p>
      )}
      {kinds.map((kind) => {
        const shown = results.filter((item) => item.kind === kind);
        if (shown.length === 0) return null;
        const title = text(kindTitles[kind]);
        return (
          <section key={kind} aria-label={title} className="flex flex-col gap-1 pb-2">
            <h3 className="px-1.5 pt-1 text-caption font-semibold tracking-wide text-label-secondary uppercase">
              {title}
            </h3>
            {render(shown, kind)}
          </section>
        );
      })}
    </>
  );
}

/** Whether a tile is in the left half of its row, so its cards can open towards the panel. */
function isLeftHalf(index: number, columns: number): boolean {
  return index % columns < columns / 2;
}
