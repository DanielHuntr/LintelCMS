import { useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { useCollections } from "../content/content.queries.js";
import { classNames } from "../design/classNames.js";
import { t, tCount } from "../i18n/strings.js";
import { useDebouncedValue } from "../media/useDebouncedValue.js";
import { useSession } from "../session/SessionContext.js";
import {
  matchingPages,
  resultItems,
  type PaletteGroup,
  type PaletteItem,
  type PaletteTarget,
} from "./paletteItems.js";
import { useSearchResults } from "./search.queries.js";

/** A short pause after typing before asking the API, so each keystroke isn't a request. */
const SEARCH_DELAY_MILLISECONDS = 150;

const groupLabels: Record<PaletteGroup, Parameters<typeof t>[0]> = {
  pages: "search.group.pages",
  entries: "search.group.entries",
  media: "search.group.media",
};

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

/**
 * One search for the whole admin, opened with Cmd/Ctrl+K or the sidebar's Search button,
 * like Spotlight. It lists the admin's own pages straight away and entries and media from
 * the API as they arrive, only ever what the signed-in person may see.
 *
 * It follows the ARIA combobox pattern: focus stays in the text box, the arrow keys move
 * through the options (`aria-activedescendant`), Enter opens one and Escape closes.
 */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const dialogElement = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dialog = dialogElement.current;
    if (!dialog || !open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    input.current?.focus();
    return () => {
      dialog.close();
      opener?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogElement}
      aria-label={t("search.label")}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={classNames(
        "mx-auto mt-[12vh] w-[calc(100vw-32px)] max-w-[600px] overflow-hidden rounded-panel bg-surface-raised p-0 text-label shadow-float backdrop:bg-scrim",
        "motion-safe:transition-[opacity,scale] motion-safe:duration-150 motion-safe:ease-standard motion-safe:starting:scale-[0.98] starting:opacity-0",
      )}
    >
      <PaletteContents inputRef={input} onClose={onClose} />
    </dialog>
  );
}

function PaletteContents({
  inputRef,
  onClose,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
}) {
  const session = useSession();
  const navigate = useNavigate();
  const collections = useCollections();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const settledQuery = useDebouncedValue(query, SEARCH_DELAY_MILLISECONDS);
  const search = useSearchResults(settledQuery);
  const listboxId = useId();
  const hintId = useId();
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  const hasQuery = query.trim() !== "";
  const items: PaletteItem[] = hasQuery
    ? [
        ...matchingPages(query, {
          permissions: session.permissions,
          enabledPlugins: session.enabledPlugins,
          collections: collections.data ?? [],
        }),
        // Results for an older query stay until the new ones arrive, but only while typing on.
        ...(search.data && settledQuery.trim() !== "" ? resultItems(search.data) : []),
      ]
    : [];
  const active = Math.min(activeIndex, Math.max(items.length - 1, 0));
  const isSearching = hasQuery && (search.isFetching || settledQuery !== query);

  function open(target: PaletteTarget) {
    onClose();
    if (target.kind === "page") {
      void navigate({ to: target.path });
    } else if (target.kind === "collection") {
      void navigate({
        to: "/content/$collection",
        params: { collection: target.collectionHandle },
      });
    } else if (target.kind === "entry") {
      void navigate({
        to: "/content/$collection/$entryId",
        params: { collection: target.collectionHandle, entryId: target.entryId },
      });
    } else {
      void navigate({ to: "/media", search: { asset: target.assetId, search: target.filename } });
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const lastIndex = items.length - 1;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (items.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((active + step + items.length) % items.length);
    } else if (event.key === "Home" && items.length > 0 && event.ctrlKey) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End" && items.length > 0 && event.ctrlKey) {
      event.preventDefault();
      setActiveIndex(lastIndex);
    } else if (event.key === "Enter") {
      const item = items[active];
      if (item) {
        event.preventDefault();
        open(item.target);
      }
    }
  }

  useEffect(() => {
    document.getElementById(optionId(active))?.scrollIntoView?.({ block: "nearest" });
  });

  const status = !hasQuery
    ? t("search.hint")
    : isSearching && items.length === 0
      ? t("search.searching")
      : search.isError
        ? t("search.failed")
        : items.length === 0
          ? t("search.noResults", { query: query.trim() })
          : tCount(
              { one: "search.resultCount.one", other: "search.resultCount.other" },
              items.length,
            );

  return (
    <div className="flex max-h-[min(560px,76vh)] flex-col">
      <div className="flex items-center gap-2.5 px-4 py-3 hairline-bottom">
        <Search
          aria-hidden="true"
          strokeWidth={2}
          className="size-5 shrink-0 text-label-secondary"
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={t("search.label")}
          aria-expanded={items.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={items.length > 0 ? optionId(active) : undefined}
          aria-autocomplete="list"
          aria-describedby={hintId}
          autoComplete="off"
          spellCheck={false}
          placeholder={t("search.placeholder")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className="h-8 min-w-0 flex-1 bg-transparent text-headline font-normal text-label outline-none placeholder:text-label-tertiary"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label={t("search.close")}
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-fill text-label-secondary hover:text-label focus-visible:focus-ring"
        >
          <X aria-hidden="true" strokeWidth={2.25} className="size-3.5" />
        </button>
      </div>

      <ul
        id={listboxId}
        role="listbox"
        aria-label={t("search.label")}
        className="min-h-0 overflow-y-auto p-2 empty:hidden"
      >
        {items.map((item, index) => {
          const startsGroup = items[index - 1]?.group !== item.group;
          return (
            <PaletteOption
              key={item.id}
              id={optionId(index)}
              item={item}
              groupLabel={startsGroup ? t(groupLabels[item.group]) : undefined}
              isActive={index === active}
              onHover={() => setActiveIndex(index)}
              onChoose={() => open(item.target)}
            />
          );
        })}
      </ul>

      <p
        id={hintId}
        role="status"
        className="shrink-0 px-4 py-2.5 text-footnote text-label-secondary hairline-top"
      >
        {status}
      </p>
    </div>
  );
}

function PaletteOption({
  id,
  item,
  groupLabel,
  isActive,
  onHover,
  onChoose,
}: {
  id: string;
  item: PaletteItem;
  groupLabel: string | undefined;
  isActive: boolean;
  onHover: () => void;
  onChoose: () => void;
}) {
  const Icon = item.icon;
  return (
    <>
      {groupLabel && (
        // Group names are read as part of the first option of each group, not as options.
        <li
          role="presentation"
          aria-hidden="true"
          className="px-2.5 pt-2.5 pb-1 text-caption font-medium text-label-secondary first:pt-1"
        >
          {groupLabel}
        </li>
      )}
      <li
        id={id}
        role="option"
        aria-selected={isActive}
        aria-label={[groupLabel, item.label, item.detail].filter(Boolean).join(", ")}
        onMouseMove={onHover}
        onClick={onChoose}
        className={classNames(
          "flex cursor-default items-center gap-3 rounded-control px-2.5 py-2",
          isActive ? "bg-accent-fill text-on-accent" : "text-label",
        )}
      >
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt=""
            className="size-8 shrink-0 rounded-[6px] object-cover"
          />
        ) : (
          Icon && (
            <span
              className={classNames(
                "flex size-8 shrink-0 items-center justify-center rounded-[6px]",
                isActive ? "bg-on-accent/20" : "bg-fill",
              )}
            >
              <Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />
            </span>
          )
        )}
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body font-medium">{item.label}</span>
          {item.detail && (
            <span
              className={classNames(
                "truncate text-footnote",
                isActive ? "text-on-accent/85" : "text-label-secondary",
              )}
            >
              {item.detail}
            </span>
          )}
        </span>
      </li>
    </>
  );
}
