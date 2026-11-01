import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { useId, useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { listEntries } from "../content/content.api.js";
import { contentKeys, useCollections } from "../content/content.queries.js";
import type { EntrySummary } from "../content/content.types.js";
import { EntryStatusBadge } from "../content/EntryStatusBadge.js";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { Dialog } from "../design/Dialog.js";
import { SearchField } from "../design/SearchField.js";
import { Skeleton } from "../design/Skeleton.js";
import { useDebouncedValue } from "../media/useDebouncedValue.js";
import { t } from "../i18n/strings.js";

export interface PickedEntry extends EntrySummary {
  collectionHandle: string;
}

interface EntryPickerDialogProps {
  open: boolean;
  title: string;
  /** Collection handles to choose from. Empty means any collection. */
  collections: readonly string[];
  /** Already chosen, shown ticked and not offered again. */
  chosenIds: readonly string[];
  onChoose: (entry: PickedEntry) => void;
  onClose: () => void;
}

/**
 * Finds an entry to link to: pick a collection (when there's a choice), search by title,
 * then choose. Used by entries fields and by menu items that link to a page.
 */
export function EntryPickerDialog({
  open,
  title,
  collections,
  chosenIds,
  onChoose,
  onClose,
}: EntryPickerDialogProps) {
  const allCollections = useCollections();
  const offered = (allCollections.data ?? []).filter(
    (collection) => collections.length === 0 || collections.includes(collection.handle),
  );
  const [pickedHandle, setPickedHandle] = useState<string | null>(null);
  const collectionHandle = pickedHandle ?? offered[0]?.handle;
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const selectId = useId();
  const filter = { search: debouncedSearch || undefined, page: 1, perPage: 30 };
  const entries = useQuery({
    queryKey: contentKeys.entries(collectionHandle ?? "", filter),
    queryFn: () => listEntries(collectionHandle ?? "", filter),
    enabled: open && collectionHandle !== undefined,
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={t("fields.entries.pickerDescription")}
      footer={<Button onClick={onClose}>{t("common.done")}</Button>}
    >
      <div className="flex flex-col gap-3 pt-1">
        {offered.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={selectId} className="text-footnote font-medium text-label">
              {t("fields.entries.collection")}
            </label>
            <div className="relative">
              <select
                id={selectId}
                value={collectionHandle ?? ""}
                onChange={(event) => setPickedHandle(event.target.value)}
                className={classNames("h-9 appearance-none pe-9", controlClasses())}
              >
                {offered.map((collection) => (
                  <option key={collection.handle} value={collection.handle}>
                    {collection.name}
                  </option>
                ))}
              </select>
              <ChevronsUpDown
                aria-hidden="true"
                strokeWidth={2}
                className="pointer-events-none absolute top-1/2 inset-e-3 size-4 -translate-y-1/2 text-label-secondary"
              />
            </div>
          </div>
        )}
        <SearchField
          label={t("fields.entries.search")}
          value={search}
          onValueChange={setSearch}
          data-autofocus
        />
        {(allCollections.isError || entries.isError) && (
          <LoadError
            error={allCollections.error ?? entries.error}
            onRetry={() =>
              void (allCollections.isError ? allCollections.refetch() : entries.refetch())
            }
          />
        )}
        {allCollections.data && offered.length === 0 && (
          <p className="py-6 text-center text-footnote text-label-secondary">
            {t("fields.entries.noCollections")}
          </p>
        )}
        {entries.isPending && collectionHandle !== undefined && (
          <div aria-hidden="true" className="flex flex-col gap-2">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-11" />
            ))}
          </div>
        )}
        {entries.data && entries.data.entries.length === 0 && (
          <p className="py-6 text-center text-footnote text-label-secondary">
            {t("fields.entries.noMatches")}
          </p>
        )}
        {entries.data && entries.data.entries.length > 0 && collectionHandle && (
          <ul className="-mx-2 flex flex-col">
            {entries.data.entries.map((entry) => {
              const isChosen = chosenIds.includes(entry.id);
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    disabled={isChosen}
                    onClick={() => onChoose({ ...entry, collectionHandle })}
                    className="flex w-full items-center gap-3 rounded-control px-2 py-2.5 text-start transition-colors duration-150 ease-standard hover:bg-fill focus-visible:focus-ring disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <span className="min-w-0 flex-1 truncate text-body text-label">
                      {entry.title || t("entries.untitled")}
                    </span>
                    {isChosen ? (
                      <span className="flex items-center gap-1 text-footnote text-label-secondary">
                        <Check aria-hidden="true" strokeWidth={2.5} className="size-3.5" />
                        {t("fields.entries.chosen")}
                      </span>
                    ) : (
                      <EntryStatusBadge status={entry.status} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
