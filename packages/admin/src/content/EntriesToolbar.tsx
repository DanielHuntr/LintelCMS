import { useEffect, useState } from "react";
import { SearchField } from "../design/SearchField.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { t } from "../i18n/strings.js";
import type { EntryStatus } from "./content.types.js";

export type StatusFilter = "all" | EntryStatus;

const statusOptions = [
  { value: "all", label: t("entries.filter.all") },
  { value: "draft", label: t("entries.filter.drafts") },
  { value: "published", label: t("entries.filter.published") },
  { value: "scheduled", label: t("entries.filter.scheduled") },
] as const;

const searchDelayMs = 300;

interface EntriesToolbarProps {
  collectionName: string;
  search: string;
  status: StatusFilter;
  onSearchChange: (search: string) => void;
  onStatusChange: (status: StatusFilter) => void;
}

/** Search and the status filter above the entries list. */
export function EntriesToolbar({
  collectionName,
  search,
  status,
  onSearchChange,
  onStatusChange,
}: EntriesToolbarProps) {
  // The box updates as you type; the search itself waits for a pause, so each key isn't a request.
  const [typed, setTyped] = useState(search);

  useEffect(() => {
    if (typed === search) return;
    const timer = setTimeout(() => onSearchChange(typed), searchDelayMs);
    return () => clearTimeout(timer);
  }, [typed, search, onSearchChange]);

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <SegmentedControl
        label={t("entries.filter.label")}
        options={statusOptions}
        value={status}
        onChange={onStatusChange}
      />
      <SearchField
        label={t("entries.search", { name: collectionName.toLowerCase() })}
        value={typed}
        onValueChange={setTyped}
        className="w-64"
      />
    </div>
  );
}
