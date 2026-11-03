import { ChevronRight } from "lucide-react";
import { useId, useState, type MouseEvent, type ReactNode, type Ref } from "react";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { t } from "../i18n/strings.js";
import { type VariantDraft, variantName } from "./productDraft.js";
import {
  nameInGroup,
  sharedText,
  stockText,
  totalStock,
  type VariantGroup,
} from "./variantTableState.js";

/**
 * The rows of the variants table. On a narrow card the table's parts stop being laid out as a
 * table (see the `@max-lg` classes) and each row stacks: the name, then price and stock. A
 * change of `display` can take a table's meaning away from screen readers, so the parts name
 * their roles outright.
 */
const stackedRowClasses =
  "@max-lg:grid @max-lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] @max-lg:items-center @max-lg:gap-x-2 @max-lg:gap-y-2 @max-lg:px-4 @max-lg:py-3";
const cellClasses = "px-1.5 py-2 align-middle @max-lg:p-0";
export const tickCellClasses = classNames(
  cellClasses,
  "ps-5 @max-lg:col-start-1 @max-lg:row-start-1 @max-lg:ps-0",
);
const nameCellClasses =
  "px-1.5 py-2 text-start align-middle font-normal @max-lg:col-span-2 @max-lg:col-start-2 @max-lg:row-start-1 @max-lg:p-0";
const priceCellClasses = classNames(cellClasses, "@max-lg:col-start-2 @max-lg:row-start-2");
const stockCellClasses = classNames(cellClasses, "@max-lg:col-start-3 @max-lg:row-start-2");
export const skuCellClasses = classNames(cellClasses, "@max-2xl:hidden");
const editCellClasses = classNames(
  cellClasses,
  "pe-4 text-end @max-lg:col-start-3 @max-lg:row-start-1 @max-lg:justify-self-end @max-lg:pe-0",
);

/** Rows open with a click anywhere that isn't already a control. Keyboards use the Edit button. */
function isPlainClick(event: MouseEvent): boolean {
  return (
    event.target instanceof Element && !event.target.closest("input, button, label, a, select")
  );
}

interface TickBoxProps {
  label: string;
  state: "all" | "some" | "none";
  onChange: () => void;
  children?: ReactNode;
}

/** A tick box with room around it for a finger. */
export function TickBox({ label, state, onChange, children }: TickBoxProps) {
  return (
    <label className="-m-2 flex items-center gap-2 p-2 text-footnote text-label-secondary">
      <input
        type="checkbox"
        aria-label={label}
        className="size-4 accent-accent"
        checked={state === "all"}
        ref={(box) => {
          if (box) box.indeterminate = state === "some";
        }}
        onChange={onChange}
      />
      {children}
    </label>
  );
}

interface CellBoxProps {
  label: string;
  /** Shown inside the box on a narrow card, where the column headings aren't. */
  shortLabel?: string;
  value: string;
  placeholder?: string;
  /** For when the short label already says what the placeholder does, and both won't fit. */
  hidesPlaceholderWhenStacked?: boolean;
  inputMode?: "decimal" | "numeric";
  isInvalid?: boolean;
  describedBy?: string;
  align?: "start" | "end";
  onChange: (value: string) => void;
  onBlur?: () => void;
  onKeyDown?: (key: string, prevent: () => void) => void;
}

/** A small text box inside a table cell; its column heading does the job of a visible label. */
function CellBox({
  label,
  shortLabel,
  value,
  placeholder,
  hidesPlaceholderWhenStacked = false,
  inputMode,
  isInvalid = false,
  describedBy,
  align = "end",
  onChange,
  onBlur,
  onKeyDown,
}: CellBoxProps) {
  return (
    <div className="relative">
      {shortLabel && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-footnote text-label-secondary @min-lg:hidden"
        >
          {shortLabel}
        </span>
      )}
      <input
        aria-label={label}
        aria-invalid={isInvalid ? true : undefined}
        aria-describedby={describedBy}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        onKeyDown={(event) => onKeyDown?.(event.key, () => event.preventDefault())}
        className={classNames(
          controlClasses({ hasError: isInvalid }),
          "h-9 tabular-nums placeholder:text-footnote",
          align === "end" && "text-end",
          hidesPlaceholderWhenStacked && "@max-lg:placeholder:text-transparent",
        )}
      />
    </div>
  );
}

interface VariantRowProps {
  variant: VariantDraft;
  /** The group's option, left out of the name shown here. */
  groupedBy: number | null;
  /** The location the stock box edits; a shop always has one once it's set up. */
  locationId: string | undefined;
  /** Named in the stock box's label when the shop has several. */
  locationName: string | null;
  isSelected: boolean;
  /** No tick boxes when there's only one variant. */
  canSelect: boolean;
  problems: readonly string[];
  hasPriceProblem: boolean;
  hasStockProblem: boolean;
  hasSkuProblem: boolean;
  editButton: Ref<HTMLButtonElement>;
  onToggle: () => void;
  onChange: (changes: Partial<VariantDraft>) => void;
  onStockChange: (text: string) => void;
  onEdit: () => void;
}

export function VariantTableRow({
  variant,
  groupedBy,
  locationId,
  locationName,
  isSelected,
  canSelect,
  problems,
  hasPriceProblem,
  hasStockProblem,
  hasSkuProblem,
  editButton,
  onToggle,
  onChange,
  onStockChange,
  onEdit,
}: VariantRowProps) {
  const problemId = useId();
  const name = variantName(variant);
  const describedBy = problems.length > 0 ? problemId : undefined;

  return (
    <tr
      role="row"
      onClick={(event) => {
        if (isPlainClick(event)) onEdit();
      }}
      className={classNames(
        "cursor-pointer hairline-top hover:bg-fill/50",
        isSelected && "bg-accent/6",
        stackedRowClasses,
      )}
    >
      {canSelect && (
        <td role="cell" className={tickCellClasses}>
          <TickBox
            label={t("shop.variants.selectOne", { name })}
            state={isSelected ? "all" : "none"}
            onChange={onToggle}
          />
        </td>
      )}
      <th
        role="rowheader"
        scope="row"
        className={classNames(
          nameCellClasses,
          "@max-lg:pe-14",
          groupedBy !== null && "ps-7 @max-lg:ps-0",
          !canSelect && "ps-5 @max-lg:ps-0",
        )}
      >
        <span className="block truncate text-body text-label">
          {nameInGroup(variant, groupedBy)}
        </span>
        {problems.length > 0 && (
          <span id={problemId} className="block text-footnote text-danger">
            {problems.join(" ")}
          </span>
        )}
      </th>
      <td role="cell" className={priceCellClasses}>
        <CellBox
          label={t("shop.variants.priceFor", { name })}
          shortLabel={t("shop.variants.shortPrice")}
          inputMode="decimal"
          placeholder="0"
          value={variant.price}
          isInvalid={hasPriceProblem}
          describedBy={describedBy}
          onChange={(price) => onChange({ price })}
        />
      </td>
      <td role="cell" className={stockCellClasses}>
        {locationId !== undefined && (
          <CellBox
            label={
              locationName
                ? t("shop.variants.stockAtFor", { location: locationName, name })
                : t("shop.variants.stockFor", { name })
            }
            shortLabel={
              variant.inventoryTracked
                ? t("shop.variants.column.stock")
                : t("shop.variants.notCounted")
            }
            inputMode="numeric"
            placeholder={variant.inventoryTracked ? "0" : t("shop.variants.notCounted")}
            hidesPlaceholderWhenStacked={!variant.inventoryTracked}
            value={stockText(variant, locationId)}
            isInvalid={hasStockProblem}
            describedBy={describedBy}
            onChange={onStockChange}
          />
        )}
      </td>
      <td role="cell" className={skuCellClasses}>
        <CellBox
          label={t("shop.variants.skuFor", { name })}
          align="start"
          value={variant.sku}
          isInvalid={hasSkuProblem}
          describedBy={describedBy}
          onChange={(sku) => onChange({ sku })}
        />
      </td>
      <td role="cell" className={editCellClasses}>
        <Button
          ref={editButton}
          variant="plain"
          size="small"
          aria-label={t("shop.variants.editFor", { name })}
          onClick={onEdit}
        >
          {t("shop.variants.edit")}
        </Button>
      </td>
    </tr>
  );
}

interface GroupBoxProps {
  label: string;
  shortLabel: string;
  sharedValue: string;
  inputMode: "decimal" | "numeric";
  onSet: (text: string) => void;
}

/**
 * A box in a group row. It shows the value its variants share and changes them all once the
 * typing is finished, not on every key: a half-typed price, or one typed and then rubbed out,
 * must not wipe out prices that were different.
 */
function GroupBox({ label, shortLabel, sharedValue, inputMode, onSet }: GroupBoxProps) {
  const [typed, setTyped] = useState<string | null>(null);

  function finish() {
    if (typed !== null && typed.trim() !== "" && typed.trim() !== sharedValue) onSet(typed.trim());
    setTyped(null);
  }

  return (
    <CellBox
      label={label}
      shortLabel={shortLabel}
      inputMode={inputMode}
      placeholder={t("shop.variants.setAll")}
      value={typed ?? sharedValue}
      onChange={setTyped}
      onBlur={finish}
      onKeyDown={(key, prevent) => {
        if (key === "Enter") {
          // Enter would otherwise save the whole product.
          prevent();
          finish();
        } else if (key === "Escape") {
          setTyped(null);
        }
      }}
    />
  );
}

interface VariantGroupRowProps {
  group: VariantGroup;
  isOpen: boolean;
  canSelect: boolean;
  selection: "all" | "some" | "none";
  locationId: string | undefined;
  locationName: string | null;
  locationIds: readonly string[];
  onToggleOpen: () => void;
  onToggleSelected: () => void;
  onSetPrice: (text: string) => void;
  onSetStock: (text: string) => void;
}

/** One value of the grouping option: folds its variants, and sets their price and stock at once. */
export function VariantGroupRow({
  group,
  isOpen,
  canSelect,
  selection,
  locationId,
  locationName,
  locationIds,
  onToggleOpen,
  onToggleSelected,
  onSetPrice,
  onSetStock,
}: VariantGroupRowProps) {
  const variants = group.rows.map((row) => row.variant);
  const { inStock, notCounted } = totalStock(variants, locationIds);
  const count = variants.length;
  const name = group.name;

  return (
    <tr
      role="row"
      onClick={(event) => {
        if (isPlainClick(event)) onToggleOpen();
      }}
      className={classNames("cursor-pointer hairline-top hover:bg-fill/50", stackedRowClasses)}
    >
      {canSelect && (
        <td role="cell" className={tickCellClasses}>
          <TickBox
            label={t("shop.variants.selectGroup", { name })}
            state={selection}
            onChange={onToggleSelected}
          />
        </td>
      )}
      <th role="rowheader" scope="rowgroup" className={nameCellClasses}>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={onToggleOpen}
          className="flex max-w-full items-center gap-1.5 rounded-control text-start focus-visible:focus-ring"
        >
          <ChevronRight
            aria-hidden="true"
            strokeWidth={2.25}
            className={classNames(
              "size-4 shrink-0 text-label-secondary motion-safe:transition-transform motion-safe:duration-150 rtl:-scale-x-100",
              isOpen && "rotate-90 rtl:scale-x-100",
            )}
          />
          <span className="min-w-0">
            <span className="block truncate text-body font-medium text-label">{name}</span>
            <span className="block truncate text-footnote text-label-secondary">
              {notCounted === count
                ? t("shop.variants.groupSummaryNotCounted", { count })
                : t("shop.variants.groupSummary", { count, stock: inStock })}
            </span>
          </span>
        </button>
      </th>
      <td role="cell" className={priceCellClasses}>
        <GroupBox
          label={t("shop.variants.groupPrice", { name })}
          shortLabel={t("shop.variants.shortPrice")}
          inputMode="decimal"
          sharedValue={sharedText(variants.map((variant) => variant.price))}
          onSet={onSetPrice}
        />
      </td>
      <td role="cell" className={stockCellClasses}>
        {locationId !== undefined && (
          <GroupBox
            label={
              locationName
                ? t("shop.variants.groupStockAt", { location: locationName, name })
                : t("shop.variants.groupStock", { name })
            }
            shortLabel={t("shop.variants.column.stock")}
            inputMode="numeric"
            sharedValue={sharedText(variants.map((variant) => stockText(variant, locationId)))}
            onSet={onSetStock}
          />
        )}
      </td>
      <td role="cell" className={skuCellClasses} />
      <td role="cell" className={classNames(editCellClasses, "@max-lg:hidden")} />
    </tr>
  );
}
