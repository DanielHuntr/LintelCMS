import { useEffect, useRef, useState } from "react";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { classNames } from "../design/classNames.js";
import { SelectField } from "../design/SelectField.js";
import { t } from "../i18n/strings.js";
import type { OptionDraft, VariantDraft } from "./productDraft.js";
import type { InventoryLocation } from "./products.api.js";
import { VariantBulkDialog } from "./VariantBulkDialog.js";
import { VariantDrawer } from "./VariantDrawer.js";
import {
  skuCellClasses,
  TickBox,
  tickCellClasses,
  VariantGroupRow,
  VariantTableRow,
} from "./VariantRows.js";
import {
  groupingChoices,
  groupPosition,
  groupVariants,
  totalStock,
  type VariantGroup,
  variantProblems,
  type VariantRow,
  type VariantTableView,
  withStock,
} from "./variantTableState.js";

interface VariantTableProps {
  options: readonly OptionDraft[];
  variants: readonly VariantDraft[];
  currency: string;
  locations: InventoryLocation[];
  errors: Record<string, string>;
  view: VariantTableView;
  onViewChange: (view: VariantTableView) => void;
  onVariantsChange: (variants: VariantDraft[]) => void;
}

/** Whether all, some or none of these variants are ticked. */
function selectionOf(keys: readonly string[], selected: ReadonlySet<string>) {
  const count = keys.filter((key) => selected.has(key)).length;
  if (count === 0) return "none";
  return count === keys.length ? "all" : "some";
}

const headingClasses = "px-1.5 py-2 font-medium @max-lg:sr-only";

/**
 * One row per variant, with price, stock and (when there's room) SKU typed straight into the
 * row, and the rest in a sheet. With two options that each have several choices the rows fold
 * into groups; group rows and tick boxes change many variants at once.
 */
export function VariantTable({
  options,
  variants,
  currency,
  locations,
  errors,
  view,
  onViewChange,
  onVariantsChange,
}: VariantTableProps) {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [bulkKind, setBulkKind] = useState<"price" | "stock" | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const editButtons = useRef(new Map<string, HTMLButtonElement>());
  const lastEditedKey = useRef<string | null>(null);

  // Back to the row's Edit button: a click on the row itself leaves nothing else to return to.
  useEffect(() => {
    if (editingKey !== null || lastEditedKey.current === null) return;
    editButtons.current.get(lastEditedKey.current)?.focus();
    lastEditedKey.current = null;
  }, [editingKey]);

  const allKeys = variants.map((variant) => variant.key);
  const selected = new Set(allKeys.filter((key) => ticked.has(key)));
  const canSelect = variants.length > 1;

  const locationIds = locations.map((location) => location.id);
  const location =
    locations.find((candidate) => candidate.id === view.locationId) ?? locations[0] ?? null;
  const locationName = locations.length > 1 && location ? location.name : null;

  const choices = groupingChoices(options);
  const position = groupPosition(view.groupBy, choices);
  const groups = position === null ? null : groupVariants(variants, position);
  const editingIndex = variants.findIndex((variant) => variant.key === editingKey);
  const editing = variants[editingIndex];
  const total = totalStock(variants, locationIds);
  const columnCount = canSelect ? 6 : 5;

  function changeVariants(
    keys: ReadonlySet<string>,
    change: (variant: VariantDraft) => VariantDraft,
  ) {
    onVariantsChange(
      variants.map((variant) => (keys.has(variant.key) ? change(variant) : variant)),
    );
  }

  function setPrice(keys: ReadonlySet<string>, text: string) {
    changeVariants(keys, (variant) => ({ ...variant, price: text }));
    setAnnouncement(t("shop.variants.priceSet", { count: keys.size }));
  }

  function setStock(keys: ReadonlySet<string>, text: string) {
    if (!location) return;
    changeVariants(keys, (variant) => withStock(variant, location.id, text));
    setAnnouncement(t("shop.variants.stockSet", { count: keys.size }));
  }

  function toggleTicks(keys: readonly string[]) {
    const next = new Set(selected);
    const shouldTick = selectionOf(keys, selected) !== "all";
    for (const key of keys) {
      if (shouldTick) next.add(key);
      else next.delete(key);
    }
    setTicked(next);
  }

  function toggleGroup(group: VariantGroup) {
    onViewChange({
      ...view,
      openGroups: view.openGroups.includes(group.key)
        ? view.openGroups.filter((key) => key !== group.key)
        : [...view.openGroups, group.key],
    });
  }

  function renderRow({ variant, index }: VariantRow) {
    const hasProblem = (name: string) => errors[`variants.${index}.${name}`] !== undefined;
    const onlyThis = new Set([variant.key]);
    return (
      <VariantTableRow
        key={variant.key}
        variant={variant}
        groupedBy={position}
        locationId={location?.id}
        locationName={locationName}
        isSelected={selected.has(variant.key)}
        canSelect={canSelect}
        problems={variantProblems(errors, index)}
        hasPriceProblem={hasProblem("price") || hasProblem("prices")}
        hasStockProblem={hasProblem("stock")}
        hasSkuProblem={hasProblem("sku")}
        editButton={(button) => {
          if (button) editButtons.current.set(variant.key, button);
          else editButtons.current.delete(variant.key);
        }}
        onToggle={() => toggleTicks([variant.key])}
        onChange={(changes) => changeVariants(onlyThis, (current) => ({ ...current, ...changes }))}
        onStockChange={(text) => {
          if (location)
            changeVariants(onlyThis, (current) => withStock(current, location.id, text));
        }}
        onEdit={() => {
          lastEditedKey.current = variant.key;
          setEditingKey(variant.key);
        }}
      />
    );
  }

  function renderGroup(group: VariantGroup) {
    const keys = group.rows.map((row) => row.variant.key);
    const keySet = new Set(keys);
    // A folded row can't show its problem, so a group with one stays open.
    const hasProblem = group.rows.some((row) => variantProblems(errors, row.index).length > 0);
    const isOpen = hasProblem || view.openGroups.includes(group.key);
    return (
      <tbody key={group.key} role="rowgroup" className="@max-lg:block">
        <VariantGroupRow
          group={group}
          isOpen={isOpen}
          canSelect={canSelect}
          selection={selectionOf(keys, selected)}
          locationId={location?.id}
          locationName={locationName}
          locationIds={locationIds}
          onToggleOpen={() => toggleGroup(group)}
          onToggleSelected={() => toggleTicks(keys)}
          onSetPrice={(text) => setPrice(keySet, text)}
          onSetStock={(text) => setStock(keySet, text)}
        />
        {isOpen && group.rows.map(renderRow)}
      </tbody>
    );
  }

  return (
    <Card title={t("shop.variants.title")}>
      {(choices.length > 0 || locations.length > 1) && (
        <div className="mb-4 flex flex-wrap gap-3">
          {choices.length > 0 && (
            <SelectField
              className="min-w-40 flex-1 sm:max-w-56"
              label={t("shop.variants.groupBy")}
              value={String(position ?? "none")}
              options={[
                ...choices.map((choice) => ({
                  value: String(choice.position),
                  label:
                    choice.name ||
                    t("shop.variants.unnamedOption", { number: choice.position + 1 }),
                })),
                { value: "none", label: t("shop.variants.noGrouping") },
              ]}
              onValueChange={(value) =>
                onViewChange({ ...view, groupBy: value === "none" ? "none" : Number(value) })
              }
            />
          )}
          {locations.length > 1 && location && (
            <SelectField
              className="min-w-40 flex-1 sm:max-w-56"
              label={t("shop.variants.stockLocation")}
              value={location.id}
              options={locations.map(({ id, name }) => ({ value: id, label: name }))}
              onValueChange={(locationId) => onViewChange({ ...view, locationId })}
            />
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div
          role="group"
          aria-label={t("shop.variants.bulkActions")}
          className="mb-3 flex flex-wrap items-center gap-2 rounded-control bg-fill px-3 py-2"
        >
          <span className="me-auto text-footnote font-medium text-label">
            {t("shop.variants.selected", { count: selected.size })}
          </span>
          <Button variant="tinted" size="small" onClick={() => setBulkKind("price")}>
            {t("shop.variants.setPrice")}
          </Button>
          {location && (
            <Button variant="tinted" size="small" onClick={() => setBulkKind("stock")}>
              {t("shop.variants.setStock")}
            </Button>
          )}
          <Button variant="plain" size="small" onClick={() => setTicked(new Set())}>
            {t("shop.variants.clearSelection")}
          </Button>
        </div>
      )}

      {errors.variants && (
        <p role="alert" className="mb-3 text-footnote text-danger">
          {errors.variants}
        </p>
      )}

      {/* The table runs to the card's edges; its container's width decides how it's laid out. */}
      <div className="@container -mx-5 -mb-5">
        <table role="table" className="w-full table-fixed text-body @max-lg:block">
          <caption className="sr-only">{t("shop.variants.tableLabel")}</caption>
          <thead role="rowgroup" className="text-footnote text-label-secondary @max-lg:block">
            <tr role="row" className="hairline-top @max-lg:flex @max-lg:px-4 @max-lg:py-2">
              {canSelect && (
                <th
                  role="columnheader"
                  scope="col"
                  className={classNames(
                    tickCellClasses,
                    "w-10 text-start font-medium whitespace-nowrap @max-lg:w-auto",
                  )}
                >
                  <span className="sr-only">{t("shop.variants.column.select")}</span>
                  <TickBox
                    label={t("shop.variants.selectAll")}
                    state={selectionOf(allKeys, selected)}
                    onChange={() => toggleTicks(allKeys)}
                  >
                    <span aria-hidden="true" className="@min-lg:hidden">
                      {t("shop.variants.selectAll")}
                    </span>
                  </TickBox>
                </th>
              )}
              <th
                role="columnheader"
                scope="col"
                className={classNames(headingClasses, "text-start", !canSelect && "ps-5")}
              >
                {t("shop.variants.column.name")}
              </th>
              <th
                role="columnheader"
                scope="col"
                className={classNames(headingClasses, "w-28 text-end")}
              >
                {t("shop.variants.column.price", { currency })}
              </th>
              <th
                role="columnheader"
                scope="col"
                className={classNames(headingClasses, "w-28 text-end")}
              >
                {t("shop.variants.column.stock")}
              </th>
              <th
                role="columnheader"
                scope="col"
                className={classNames(skuCellClasses, "w-36 text-start font-medium")}
              >
                {t("shop.variants.column.sku")}
              </th>
              <th
                role="columnheader"
                scope="col"
                className={classNames(headingClasses, "w-18 pe-4")}
              >
                <span className="sr-only">{t("shop.variants.column.actions")}</span>
              </th>
            </tr>
          </thead>
          {groups ? (
            groups.map(renderGroup)
          ) : (
            <tbody role="rowgroup" className="@max-lg:block">
              {variants.map((variant, index) => renderRow({ variant, index }))}
            </tbody>
          )}
          <tfoot role="rowgroup" className="@max-lg:block">
            <tr role="row" className="hairline-top @max-lg:block">
              <td
                role="cell"
                colSpan={columnCount}
                className="px-5 py-3 text-footnote text-label-secondary @max-lg:block @max-lg:px-4"
              >
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                  <span>{t("shop.variants.count", { count: variants.length })}</span>
                  <span className="font-medium text-label tabular-nums">
                    {total.notCounted === variants.length
                      ? t("shop.variants.totalStockNotCounted")
                      : total.notCounted > 0
                        ? t("shop.variants.totalStockSomeNotCounted", {
                            count: total.inStock,
                            notCounted: total.notCounted,
                          })
                        : t("shop.variants.totalStock", { count: total.inStock })}
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {editing && (
        <VariantDrawer
          variant={editing}
          index={editingIndex}
          currency={currency}
          locations={locations}
          errors={errors}
          onChange={(changes) =>
            changeVariants(new Set([editing.key]), (current) => ({ ...current, ...changes }))
          }
          onClose={() => setEditingKey(null)}
        />
      )}

      {bulkKind && (
        <VariantBulkDialog
          kind={bulkKind}
          count={selected.size}
          currency={currency}
          locationName={locationName}
          onApply={(text) => {
            if (bulkKind === "price") setPrice(selected, text);
            else setStock(selected, text);
            setBulkKind(null);
          }}
          onClose={() => setBulkKind(null)}
        />
      )}
    </Card>
  );
}
