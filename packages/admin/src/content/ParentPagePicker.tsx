import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown } from "lucide-react";
import { useId } from "react";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { t } from "../i18n/strings.js";
import { listEntries } from "./content.api.js";
import { contentKeys } from "./content.queries.js";
import { PanelSection } from "./PanelSection.js";
import { subtreeIds, treeDepths } from "./treeOrder.js";

interface ParentPagePickerProps {
  collectionHandle: string;
  /** Undefined for a new page. */
  entryId: string | undefined;
  /** Parents have to be in the same language. */
  locale: string | undefined;
  parentId: string | null;
  onChange: (parentId: string | null) => void;
}

const pagesToOffer = { page: 1, perPage: 100 };

/** Which page this page sits under. A page can't go under itself or one of its own children. */
export function ParentPagePicker({
  collectionHandle,
  entryId,
  locale,
  parentId,
  onChange,
}: ParentPagePickerProps) {
  const selectId = useId();
  const filter = { ...pagesToOffer, locale };
  const { data } = useQuery({
    queryKey: contentKeys.entries(collectionHandle, filter),
    queryFn: () => listEntries(collectionHandle, filter),
  });

  const pages = data?.entries ?? [];
  const excluded = entryId ? subtreeIds(pages, entryId) : new Set<string>();
  const depths = treeDepths(pages);
  const options = pages.filter((page) => !excluded.has(page.id));

  return (
    <PanelSection title={t("editor.panel.parent")}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={selectId} className="sr-only">
          {t("editor.parentLabel")}
        </label>
        <div className="relative">
          <select
            id={selectId}
            value={parentId ?? ""}
            onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
            className={classNames("h-9 appearance-none pr-9", controlClasses())}
          >
            <option value="">{t("editor.parentNone")}</option>
            {options.map((page) => (
              <option key={page.id} value={page.id}>
                {/* Options can't be styled, so em spaces show the nesting. */}
                {" ".repeat(depths.get(page.id) ?? 0)}
                {page.title || t("entries.untitled")}
              </option>
            ))}
          </select>
          <ChevronsUpDown
            aria-hidden="true"
            strokeWidth={2}
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-label-secondary"
          />
        </div>
        <p className="text-footnote text-label-secondary">{t("editor.parentHint")}</p>
      </div>
    </PanelSection>
  );
}
