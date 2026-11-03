import { canUseFreeLayout, canUsePlacedGrid, spacingTokens } from "@lintel/builder-model";
import { ArrowDown, ArrowRight, LayoutGrid, Move } from "lucide-react";
import { type KeyboardEvent, useMemo, useRef } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { ChoiceGroup, classNames, Labelled, PanelSection } from "../ui/controls.js";
import { useDesignTools } from "./design-tools.js";
import { GridSettings, selfAlignments } from "./GridPlaceControls.js";
import {
  type StyleEditing,
  StyleEditingContext,
  useStyleEditing,
  useStyleField,
  useStyleReader,
} from "./style-field.js";
import { layoutSummary } from "./style-summaries.js";
import { StyleChips, StyleSelect, StyleTextInput, useSizeChips } from "./StyleInputs.js";
import { useStyleSummary } from "./summary-names.js";

/** The four ways things inside a section, box or container can be arranged. */
export type Arrangement = "stack" | "row" | "grid" | "free";

/**
 * How what's inside is arranged now. "flow" is plain block layout, the browser's own one
 * under another: it shows as One under another, and only becomes a stack when one of its
 * details is changed, so pages saved before look exactly the same. "other" is anything else
 * set by hand in Advanced (hidden, inline and so on), which none of the four choices
 * describe.
 */
export type ArrangementReading = Arrangement | "flow" | "other";

export function readArrangement(
  node: { freeLayout?: unknown; placedGrid?: unknown },
  display: string | undefined,
  direction: string | undefined,
): ArrangementReading {
  if (node.freeLayout) return "free";
  if (node.placedGrid) return "grid";
  if (display === "grid" || display === "inline-grid") return "grid";
  if (display === "flex" || display === "inline-flex") {
    return direction === "row" || direction === "row-reverse" ? "row" : "stack";
  }
  return display === undefined || display === "block" ? "flow" : "other";
}

const twoColumns = "repeat(2, minmax(0, 1fr))";

/**
 * How the elements inside are arranged: one under another, side by side, on a grid, or
 * anywhere (sections, boxes and containers only), with the details for the chosen one under
 * it: alignment and the space between things, wrapping, columns, and placing things on the
 * grid by hand. One control for what used to be two (Arrange and Layout); see
 * docs/decisions/0046-one-builder-for-everyone.md.
 */
export function LayoutSection({ advanced }: { advanced: boolean }) {
  const text = useBuilderText();
  const tools = useDesignTools();
  const editing = useStyleEditing();
  const read = useStyleReader();
  const { node } = tools;
  const reading = readArrangement(node, read("display"), read("flexDirection"));
  const shown: Arrangement | undefined =
    reading === "flow" ? "stack" : reading === "other" ? undefined : reading;
  const canPlaceOnGrid = canUsePlacedGrid(node);
  const label = text("pageBuilder.style.arrange");
  const placedGrid = node.placedGrid;
  const isFree = node.freeLayout !== undefined;
  const summary = useStyleSummary((reader) =>
    isFree
      ? text("pageBuilder.layout.free")
      : placedGrid
        ? text("pageBuilder.grid.summary", { count: placedGrid.columns })
        : layoutSummary(reader, text),
  );

  // Plain block layout becomes a stack the moment one of its details is changed.
  const detailsEditing = useMemo<StyleEditing>(
    () =>
      reading === "flow"
        ? {
            ...editing,
            change: (values, changeLabel) =>
              editing.change({ display: "flex", flexDirection: "column", ...values }, changeLabel),
          }
        : editing,
    [reading, editing],
  );

  const choose = (next: Arrangement) => {
    if (next === shown) return;
    if (next === "free") {
      tools.setFreeLayout({ stackOnPhone: true });
      return;
    }
    if (node.freeLayout) tools.setFreeLayout(null);
    if (node.placedGrid) tools.setPlacedGrid(null);
    if (next === "stack") editing.change({ display: "flex", flexDirection: "column" }, label);
    if (next === "row") {
      editing.change({ display: "flex", flexDirection: "row", flexWrap: "wrap" }, label);
    }
    if (next === "grid") {
      editing.change(
        { display: "grid", gridTemplateColumns: read("gridTemplateColumns") ?? twoColumns },
        label,
      );
    }
  };

  const choices = [
    { value: "stack" as const, label: text("pageBuilder.layout.stack"), icon: ArrowDown },
    { value: "row" as const, label: text("pageBuilder.layout.row"), icon: ArrowRight },
    { value: "grid" as const, label: text("pageBuilder.layout.grid"), icon: LayoutGrid },
    ...(canUseFreeLayout(node)
      ? [{ value: "free" as const, label: text("pageBuilder.layout.free"), icon: Move }]
      : []),
  ];

  return (
    <PanelSection
      title={text("pageBuilder.style.layout")}
      sectionId="layout"
      summary={summary.summary}
      linked={summary.linked}
    >
      <ChoiceGroup<Arrangement>
        label={text("pageBuilder.layout.howArranged")}
        value={shown}
        onChange={choose}
        twoColumns={choices.length === 4}
        choices={choices}
      />
      <StyleEditingContext.Provider value={detailsEditing}>
        {(shown === "stack" || shown === "row") && <FlowDetails isRow={shown === "row"} />}
        {shown === "grid" && !placedGrid && <GridDetails canPlaceOnGrid={canPlaceOnGrid} />}
        {shown === "grid" && placedGrid && <PlacedGridDetails />}
        {shown === "free" && <FreeLayoutDetails />}
        {advanced && !isFree && !placedGrid && <AdvancedLayout isGrid={shown === "grid"} />}
      </StyleEditingContext.Provider>
    </PanelSection>
  );
}

function GapChips() {
  const text = useBuilderText();
  const gapChips = useSizeChips(spacingTokens.slice(1, 8), text("pageBuilder.style.none"));
  return (
    <StyleChips properties={["gap"]} label={text("pageBuilder.style.gap")} choices={gapChips} />
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-footnote text-label">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-[var(--color-accent-fill)]"
      />
      {label}
    </label>
  );
}

/** One under another or side by side: where things sit, the space between, and wrapping. */
function FlowDetails({ isRow }: { isRow: boolean }) {
  const text = useBuilderText();
  const wrap = useStyleField("flexWrap", text("pageBuilder.style.wrap"));
  return (
    <>
      <AlignmentPad isRow={isRow} />
      <GapChips />
      {isRow && (
        <Checkbox
          label={text("pageBuilder.style.wrap")}
          checked={wrap.value === "wrap"}
          onChange={(checked) => wrap.set(checked ? "wrap" : "nowrap")}
        />
      )}
    </>
  );
}

/** A grid that fills itself in order: how many columns, alignment and the space between. */
function GridDetails({ canPlaceOnGrid }: { canPlaceOnGrid: boolean }) {
  const text = useBuilderText();
  const tools = useDesignTools();
  const columns = useStyleField("gridTemplateColumns", text("pageBuilder.style.columns"));
  const columnCount = Number(/^repeat\((\d+)/.exec(columns.value ?? "")?.[1] ?? 0);
  return (
    <>
      <ChoiceGroup
        label={text("pageBuilder.style.columns")}
        value={String(columnCount)}
        onChange={(count) => columns.set(`repeat(${count}, minmax(0, 1fr))`)}
        choices={["1", "2", "3", "4", "6"].map((count) => ({ value: count, label: count }))}
      />
      <AlignmentPad isRow={false} />
      <GapChips />
      {canPlaceOnGrid && (
        <Checkbox
          label={text("pageBuilder.layout.placeYourself")}
          checked={false}
          onChange={() => tools.setPlacedGrid({ columns: 12, stackOnPhone: true })}
        />
      )}
    </>
  );
}

/** A grid where each thing is placed by hand: its columns, phones, and the space between. */
function PlacedGridDetails() {
  const text = useBuilderText();
  const tools = useDesignTools();
  const { change } = useStyleEditing();
  return (
    <>
      <Checkbox
        label={text("pageBuilder.layout.placeYourself")}
        checked
        onChange={() => {
          // Still a grid, filled in order again.
          tools.setPlacedGrid(null);
          change(
            { display: "grid", gridTemplateColumns: twoColumns },
            text("pageBuilder.style.arrange"),
          );
        }}
      />
      <GridSettings />
      <GapChips />
    </>
  );
}

/** Anywhere: drag things where they go, and whether phones put them one under another. */
function FreeLayoutDetails() {
  const text = useBuilderText();
  const tools = useDesignTools();
  const freeLayout = tools.node.freeLayout;
  if (!freeLayout) return null;
  return (
    <>
      <p className="text-caption text-label-tertiary">
        {text("pageBuilder.design.freeLayoutHint")}
      </p>
      <Checkbox
        label={text("pageBuilder.design.stackOnPhone")}
        checked={freeLayout.stackOnPhone}
        onChange={(checked) => tools.setFreeLayout({ stackOnPhone: checked })}
      />
    </>
  );
}

/** The exact CSS, in Advanced. */
function AdvancedLayout({ isGrid }: { isGrid: boolean }) {
  const text = useBuilderText();
  return (
    <div className="grid grid-cols-2 gap-2">
      <StyleSelect
        property="display"
        label={text("pageBuilder.style.display")}
        choices={["block", "flex", "grid", "inline", "inline-block", "inline-flex", "none"].map(
          (value) => ({ value, label: value }),
        )}
      />
      <StyleTextInput property="gap" label={text("pageBuilder.style.gapExact")} />
      <StyleTextInput
        property="gridTemplateColumns"
        label={text("pageBuilder.style.gridColumns")}
        placeholder="1fr 1fr"
      />
      <StyleTextInput
        property="gridColumn"
        label={text("pageBuilder.style.gridColumn")}
        placeholder="span 2"
      />
      <StyleTextInput property="order" label={text("pageBuilder.style.order")} placeholder="0" />
      <StyleTextInput property="flexGrow" label={text("pageBuilder.style.grow")} placeholder="0" />
      <StyleTextInput property="flexBasis" label={text("pageBuilder.style.basis")} />
      {isGrid && (
        <>
          <StyleTextInput
            property="gridTemplateRows"
            label={text("pageBuilder.design.gridRows")}
            placeholder="auto 1fr"
          />
          <StyleSelect
            property="justifyItems"
            label={text("pageBuilder.design.justifyItems")}
            choices={selfAlignments(text)}
          />
          <div className="col-span-2">
            <StyleTextInput
              property="gridTemplateAreas"
              label={text("pageBuilder.design.gridAreas")}
              placeholder={'"title photo" "text photo"'}
            />
          </div>
        </>
      )}
    </div>
  );
}

const alignValues = ["flex-start", "center", "flex-end"] as const;

/**
 * Nine dots: where the elements inside sit. In a stack, across is align-items and down is
 * justify-content; in a row it's the other way round. Arrow keys move the choice.
 */
function AlignmentPad({ isRow }: { isRow: boolean }) {
  const text = useBuilderText();
  const { change } = useStyleEditing();
  const label = text("pageBuilder.style.alignment");
  const justify = useStyleField("justifyContent", label);
  const align = useStyleField("alignItems", label);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const indexOf = (value: string | undefined) =>
    Math.max(0, alignValues.indexOf((value ?? "flex-start") as (typeof alignValues)[number]));
  const across = indexOf(isRow ? justify.value : align.value);
  const down = indexOf(isRow ? align.value : justify.value);
  const names = [
    text("pageBuilder.style.alignStart"),
    text("pageBuilder.style.alignCentre"),
    text("pageBuilder.style.alignEnd"),
  ];

  const choose = (column: number, row: number) => {
    const horizontal = alignValues[column];
    const vertical = alignValues[row];
    change(
      isRow
        ? { justifyContent: horizontal, alignItems: vertical }
        : { alignItems: horizontal, justifyContent: vertical },
      label,
    );
  };
  const move = (event: KeyboardEvent, column: number, row: number) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const step = moves[event.key];
    if (!step) return;
    event.preventDefault();
    const nextColumn = Math.min(2, Math.max(0, column + step[0]));
    const nextRow = Math.min(2, Math.max(0, row + step[1]));
    choose(nextColumn, nextRow);
    buttons.current[nextRow * 3 + nextColumn]?.focus();
  };

  return (
    <Labelled
      label={label}
      overridden={
        justify.isOverridden || align.isOverridden
          ? text("pageBuilder.style.changedHere")
          : undefined
      }
    >
      {() => (
        <div
          role="radiogroup"
          aria-label={label}
          className="grid w-24 grid-cols-3 gap-1 rounded-control bg-fill p-1.5"
        >
          {[0, 1, 2].flatMap((row) =>
            [0, 1, 2].map((column) => {
              const isCurrent = row === down && column === across;
              return (
                <button
                  key={`${row}-${column}`}
                  ref={(element) => {
                    buttons.current[row * 3 + column] = element;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={isCurrent}
                  aria-label={text("pageBuilder.style.alignPosition", {
                    across: names[column] ?? "",
                    down: names[row] ?? "",
                  })}
                  tabIndex={isCurrent ? 0 : -1}
                  onClick={() => choose(column, row)}
                  onKeyDown={(event) => move(event, column, row)}
                  className="flex aspect-square items-center justify-center rounded focus-visible:focus-ring"
                >
                  <span
                    className={classNames(
                      "rounded-full transition-all duration-150",
                      isCurrent ? "size-2.5 bg-accent-fill" : "size-1.5 bg-label-tertiary",
                    )}
                  />
                </button>
              );
            }),
          )}
        </div>
      )}
    </Labelled>
  );
}
