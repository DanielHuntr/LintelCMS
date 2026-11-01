import { useQueries } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, FileText, Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ApiError } from "../api/client.js";
import { getEntry } from "../content/content.api.js";
import { contentKeys } from "../content/content.queries.js";
import { EntryStatusBadge } from "../content/EntryStatusBadge.js";
import { Button } from "../design/Button.js";
import { t } from "../i18n/strings.js";
import { EntryPickerDialog } from "./EntryPickerDialog.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { stringListFromItems, stringListValue } from "./fieldValues.js";

/** Links to other entries, in an order the editor sets, chosen from a searchable list. */
export function EntriesFieldEditor({ field, value, onChange, controlId }: FieldEditorProps) {
  const [isPicking, setIsPicking] = useState(false);
  const chosenIds = stringListValue(value);
  const { maxItems, collections = [] } = field.options;
  const isFull = maxItems !== undefined && chosenIds.length >= maxItems;
  const chosen = useQueries({
    queries: chosenIds.map((entryId) => ({
      queryKey: contentKeys.entry(entryId),
      queryFn: () => getEntry(entryId),
      staleTime: 60_000,
    })),
  });

  function save(ids: string[]) {
    onChange(stringListFromItems(ids));
  }

  function move(index: number, direction: -1 | 1) {
    const ids = [...chosenIds];
    const [moving] = ids.splice(index, 1);
    if (moving === undefined) return;
    ids.splice(index + direction, 0, moving);
    save(ids);
  }

  return (
    <div className="flex flex-col gap-2">
      {chosenIds.length > 0 && (
        <ul className="overflow-hidden rounded-card bg-fill/50">
          {chosenIds.map((entryId, index) => {
            const query = chosen[index];
            const isGone = query?.error instanceof ApiError && query.error.status === 404;
            const title = isGone
              ? t("fields.entries.deleted")
              : (query?.data?.title ?? t("fields.entries.loading")) || t("entries.untitled");
            return (
              <li key={entryId} className="flex items-center gap-3 px-3 py-2 [&+&]:hairline-top">
                <FileText
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4 shrink-0 text-label-secondary"
                />
                <span className="min-w-0 flex-1 truncate text-body text-label">{title}</span>
                {query?.data && <EntryStatusBadge status={query.data.status} />}
                <RowButton
                  label={t("fields.entries.moveUp", { title })}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ChevronUp aria-hidden="true" strokeWidth={2} className="size-4" />
                </RowButton>
                <RowButton
                  label={t("fields.entries.moveDown", { title })}
                  disabled={index === chosenIds.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ChevronDown aria-hidden="true" strokeWidth={2} className="size-4" />
                </RowButton>
                <RowButton
                  label={t("fields.entries.remove", { title })}
                  disabled={false}
                  onClick={() => save(chosenIds.filter((id) => id !== entryId))}
                >
                  <X aria-hidden="true" strokeWidth={2} className="size-4" />
                </RowButton>
              </li>
            );
          })}
        </ul>
      )}
      <Button
        id={controlId}
        variant="tinted"
        size="small"
        icon={<Plus aria-hidden="true" />}
        disabled={isFull}
        onClick={() => setIsPicking(true)}
        className="self-start"
      >
        {chosenIds.length === 0 ? t("fields.entries.choose") : t("fields.entries.chooseAnother")}
      </Button>
      {isFull && maxItems !== undefined && maxItems > 1 && (
        <p className="text-footnote text-label-secondary">
          {t("fields.entries.full", { count: maxItems })}
        </p>
      )}
      <EntryPickerDialog
        open={isPicking}
        title={t("fields.entries.pickerTitle", { label: field.label })}
        collections={collections}
        chosenIds={chosenIds}
        onChoose={(entry) => {
          const next = [...chosenIds, entry.id];
          save(next);
          if (maxItems !== undefined && next.length >= maxItems) setIsPicking(false);
        }}
        onClose={() => setIsPicking(false)}
      />
    </div>
  );
}

function RowButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className="flex size-7 shrink-0 items-center justify-center rounded-control text-label-secondary transition-colors duration-150 ease-standard hover:bg-fill hover:text-label focus-visible:focus-ring aria-disabled:pointer-events-none aria-disabled:opacity-30"
    >
      {children}
    </button>
  );
}
