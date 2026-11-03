import { FileText } from "lucide-react";
import { useState } from "react";
import type { EntryStatus } from "../content/content.types.js";
import { Dialog } from "../design/Dialog.js";
import { SearchField } from "../design/SearchField.js";
import { t, type StringKey } from "../i18n/strings.js";
import { useDebouncedValue } from "../media/useDebouncedValue.js";
import { type PickedPage, usePageSearch } from "./pageLinks.queries.js";

/** A short pause after typing before asking the API, as the command palette has. */
const SEARCH_DELAY_MILLISECONDS = 150;

const statusKeys: Record<EntryStatus, StringKey> = {
  draft: "entry.status.draft",
  published: "entry.status.published",
  scheduled: "entry.status.scheduled",
};

interface PagePickerDialogProps {
  open: boolean;
  onClose: () => void;
  onChoose: (page: PickedPage) => void;
}

/**
 * Finds a page by its title and gives back its address, for anywhere a link is typed: rich
 * text, link fields and the builder's buttons and links. The address is the form those
 * places already take for a page on the site ("/about"), so the link works like a typed one.
 */
export function PagePickerDialog({ open, onClose, onChoose }: PagePickerDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={t("pageLinks.title")}>
      {open && <PageSearch onChoose={onChoose} />}
    </Dialog>
  );
}

function PageSearch({ onChoose }: { onChoose: (page: PickedPage) => void }) {
  const [search, setSearch] = useState("");
  const settled = useDebouncedValue(search, SEARCH_DELAY_MILLISECONDS);
  const pages = usePageSearch(settled);
  const results = settled.trim() === "" ? [] : (pages.data ?? []);
  const status =
    search.trim() === ""
      ? t("pageLinks.hint")
      : pages.isError
        ? t("pageLinks.failed")
        : pages.isFetching || settled !== search
          ? t("pageLinks.searching")
          : results.length === 0
            ? t("pageLinks.none", { search: search.trim() })
            : "";

  return (
    <div className="flex flex-col gap-3 pt-1">
      <SearchField
        label={t("pageLinks.search")}
        value={search}
        onValueChange={setSearch}
        data-autofocus=""
      />
      {results.length > 0 && (
        <ul aria-label={t("pageLinks.results")} className="overflow-hidden rounded-card bg-surface">
          {results.map((page) => (
            <li key={page.id} className="not-first:hairline-top">
              <button
                type="button"
                onClick={() => onChoose({ id: page.id, title: page.title, url: page.url })}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-fill focus-visible:focus-ring"
              >
                <FileText
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4 shrink-0 text-label-secondary"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body text-label">
                    {page.title || t("tree.untitled")}
                  </span>
                  <span className="truncate text-footnote text-label-secondary">
                    {t("pageLinks.detail", {
                      collection: page.collection.name,
                      status: t(statusKeys[page.status]),
                    })}
                  </span>
                </span>
                <span className="max-w-[45%] shrink-0 truncate text-footnote text-label-secondary">
                  {page.url}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="px-4 text-footnote text-label-secondary empty:hidden">
        {status}
      </p>
      <p className="px-4 text-footnote text-label-secondary">{t("pageLinks.footer")}</p>
    </div>
  );
}
