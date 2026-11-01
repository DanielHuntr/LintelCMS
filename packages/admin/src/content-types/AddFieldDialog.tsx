import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { LoadError } from "../api/LoadError.js";
import { classNames } from "../design/classNames.js";
import { Dialog } from "../design/Dialog.js";
import { SearchField } from "../design/SearchField.js";
import { Skeleton } from "../design/Skeleton.js";
import type { FieldType } from "../fields/field.types.js";
import { t, type StringKey } from "../i18n/strings.js";
import type { FieldtypeCategory, FieldtypeDescription } from "./blueprints.types.js";
import { useFieldtypes } from "./blueprints.queries.js";
import { FieldtypeIcon } from "./fieldtypeIcons.js";
import {
  categoriesWithFieldtypes,
  fieldtypesIn,
  gridTargetIndex,
  readRecentFieldtypes,
  rememberFieldtype,
  searchFieldtypes,
} from "./fieldtypeSearch.js";

interface AddFieldDialogProps {
  open: boolean;
  onClose: () => void;
  onPick: (type: FieldType, name: string) => void;
  /** Leaves fieldtypes out, such as those that can't go inside a group. */
  allows?: (fieldtype: FieldtypeDescription) => boolean;
}

type Section = FieldtypeCategory | "recent";

export const categoryNames: Record<FieldtypeCategory, StringKey> = {
  text: "fieldPicker.category.text",
  choices: "fieldPicker.category.choices",
  dates: "fieldPicker.category.dates",
  media: "fieldPicker.category.media",
  relationships: "fieldPicker.category.relationships",
  structure: "fieldPicker.category.structure",
  layout: "fieldPicker.category.layout",
  advanced: "fieldPicker.category.advanced",
};

const allowEverything = () => true;

/**
 * "Add a field": a wide dialog with a search box (focused when it opens), categories down the
 * left and the fieldtypes of the chosen one in a grid, so everything fits without scrolling.
 * Typing searches every category by name, description and other words ("dropdown" finds
 * Select); the arrow keys move through the results and Enter adds the highlighted one.
 */
export function AddFieldDialog({
  open,
  onClose,
  onPick,
  allows = allowEverything,
}: AddFieldDialogProps) {
  const fieldtypes = useFieldtypes();
  const available = useMemo(
    () => (fieldtypes.data ?? []).filter(allows),
    [fieldtypes.data, allows],
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("builder.addField.title")}
      description={t("builder.addField.description")}
      size="wide"
      bodyClassName="flex min-h-0 flex-1 flex-col"
    >
      {fieldtypes.isError && (
        <div className="px-6">
          <LoadError error={fieldtypes.error} onRetry={() => void fieldtypes.refetch()} />
        </div>
      )}
      {fieldtypes.isPending && (
        <div className="grid grid-cols-3 gap-2 px-6 pb-5" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((cell) => (
            <Skeleton key={cell} className="h-16 rounded-card" />
          ))}
        </div>
      )}
      {fieldtypes.data && (
        <FieldtypePicker
          fieldtypes={available}
          onPick={(fieldtype) => {
            rememberFieldtype(fieldtype.type);
            onPick(fieldtype.type, fieldtype.name);
          }}
        />
      )}
    </Dialog>
  );
}

function FieldtypePicker({
  fieldtypes,
  onPick,
}: {
  fieldtypes: readonly FieldtypeDescription[];
  onPick: (fieldtype: FieldtypeDescription) => void;
}) {
  const baseId = useId();
  const gridElement = useRef<HTMLUListElement>(null);
  const searchBox = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");

  // The list may arrive after the dialog opened, too late for the dialog's own autofocus.
  useEffect(() => {
    searchBox.current?.querySelector("input")?.focus();
  }, []);
  const recent = useMemo(
    () =>
      readRecentFieldtypes().flatMap((type) => {
        const found = fieldtypes.find((fieldtype) => fieldtype.type === type);
        return found ? [found] : [];
      }),
    [fieldtypes],
  );
  const categories = categoriesWithFieldtypes(fieldtypes);
  const [section, setSection] = useState<Section>(() =>
    recent.length > 0 ? "recent" : (categories[0] ?? "text"),
  );
  const [activeIndex, setActiveIndex] = useState(0);

  const isSearching = query.trim() !== "";
  const shown = isSearching
    ? searchFieldtypes(fieldtypes, query)
    : section === "recent"
      ? recent
      : fieldtypesIn(fieldtypes, section);
  const active = shown[activeIndex];
  const optionId = (type: string) => `${baseId}-${type}`;
  const heading = isSearching
    ? t("fieldPicker.results", { count: shown.length, query: query.trim() })
    : t(section === "recent" ? "fieldPicker.recent" : categoryNames[section]);

  function changeSection(next: Section) {
    setSection(next);
    setQuery("");
    setActiveIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (active) onPick(active);
      return;
    }
    // Left and right move the text cursor while there is text to move through.
    if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && query !== "") return;
    const columns = gridElement.current
      ? getComputedStyle(gridElement.current).gridTemplateColumns.split(" ").length
      : 1;
    const target = gridTargetIndex(event.key, activeIndex, shown.length, Math.max(columns, 1));
    if (target === undefined) return;
    event.preventDefault();
    setActiveIndex(target);
    const option = shown[target];
    if (option) {
      document.getElementById(optionId(option.type))?.scrollIntoView?.({ block: "nearest" });
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={searchBox} className="px-6 pb-4">
        <SearchField
          label={t("fieldPicker.search")}
          value={query}
          onValueChange={(value) => {
            setQuery(value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded="true"
          aria-controls={`${baseId}-grid`}
          aria-activedescendant={active ? optionId(active.type) : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          data-autofocus
          className="[&_input]:h-10 [&_input]:text-body"
        />
      </div>

      <div className="flex min-h-0 flex-1 hairline-top">
        <nav
          aria-label={t("fieldPicker.categories")}
          className="hidden w-52 shrink-0 flex-col gap-0.5 overflow-y-auto p-3 sm:flex"
        >
          {recent.length > 0 && (
            <RailButton
              label={t("fieldPicker.recent")}
              isCurrent={!isSearching && section === "recent"}
              onClick={() => changeSection("recent")}
            />
          )}
          {categories.map((category) => (
            <RailButton
              key={category}
              label={t(categoryNames[category])}
              isCurrent={!isSearching && section === category}
              count={fieldtypesIn(fieldtypes, category).length}
              onClick={() => changeSection(category)}
            />
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-background/40 p-4 sm:shadow-[inset_0.5px_0_0_var(--color-separator)]">
          <h3
            id={`${baseId}-heading`}
            className="mb-3 px-1 text-footnote font-medium text-label-secondary"
          >
            {heading}
          </h3>
          {shown.length === 0 ? (
            <p className="px-1 py-10 text-center text-body text-label-secondary">
              {t("fieldPicker.noResults")}
            </p>
          ) : (
            <ul
              ref={gridElement}
              id={`${baseId}-grid`}
              role="listbox"
              aria-labelledby={`${baseId}-heading`}
              className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3"
            >
              {shown.map((fieldtype, index) => (
                <li
                  key={fieldtype.type}
                  id={optionId(fieldtype.type)}
                  role="option"
                  aria-selected={index === activeIndex}
                  onClick={() => onPick(fieldtype)}
                  onMouseMove={() => setActiveIndex(index)}
                  className={classNames(
                    "flex cursor-pointer items-start gap-3 rounded-card bg-surface p-3 hairline-ring",
                    "transition-[background-color,box-shadow] duration-150 ease-standard",
                    index === activeIndex && "outline-2 outline-accent",
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-accent/12 text-accent">
                    <FieldtypeIcon type={fieldtype.type} className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-footnote font-medium text-label">{fieldtype.name}</span>
                    <span className="line-clamp-2 text-caption text-label-secondary">
                      {fieldtype.description}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-auto px-1 pt-4 text-caption text-label-tertiary" aria-hidden="true">
            {t("fieldPicker.keyboardHint")}
          </p>
        </div>
      </div>
    </div>
  );
}

function RailButton({
  label,
  isCurrent,
  count,
  onClick,
}: {
  label: string;
  isCurrent: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={isCurrent || undefined}
      onClick={onClick}
      className={classNames(
        "flex h-8 items-center justify-between gap-2 rounded-control px-2.5 text-start text-footnote",
        "transition-colors duration-150 ease-standard focus-visible:focus-ring",
        isCurrent ? "bg-accent/12 font-medium text-accent" : "text-label hover:bg-fill",
      )}
    >
      <span className="truncate">{label}</span>
      {count !== undefined && (
        <span className="text-caption text-label-tertiary tabular-nums">{count}</span>
      )}
    </button>
  );
}
