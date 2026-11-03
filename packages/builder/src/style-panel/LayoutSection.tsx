import { findTokenByValue, spacingTokens } from "@lintel/builder-model";
import { ArrowDown, ArrowRight, Grid3x3, Square } from "lucide-react";
import { type KeyboardEvent, useRef } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { ChoiceGroup, classNames, Labelled, PanelSection } from "../ui/controls.js";
import { useDesignTools } from "./design-tools.js";
import { useStyleEditing, useStyleField, useStyleReader } from "./style-field.js";
import { layoutSummary } from "./style-summaries.js";
import { StyleChips, StyleSelect, StyleTextInput, tokenChips } from "./StyleInputs.js";

type Arrangement = "stack" | "row" | "grid" | "normal";

/**
 * How the elements inside are arranged: one under another, side by side, or in a grid. A
 * placed grid is set up in Arrange, so here it only has the space between things.
 */
export function LayoutSection({ advanced }: { advanced: boolean }) {
  const isPlacedGrid = useDesignTools().node.placedGrid !== undefined;
  return isPlacedGrid ? <PlacedGridSpacing /> : <FlowLayout advanced={advanced} />;
}

function PlacedGridSpacing() {
  const text = useBuilderText();
  const read = useStyleReader();
  return (
    <PanelSection
      title={text("pageBuilder.style.layout")}
      sectionId="layout"
      summary={findTokenByValue(read("gap"))?.label ?? read("gap") ?? ""}
    >
      <StyleChips
        properties={["gap"]}
        label={text("pageBuilder.style.gap")}
        choices={tokenChips(spacingTokens.slice(1, 8), text("pageBuilder.style.none"))}
      />
    </PanelSection>
  );
}

function FlowLayout({ advanced }: { advanced: boolean }) {
  const text = useBuilderText();
  const { change } = useStyleEditing();
  const read = useStyleReader();
  const display = useStyleField("display", text("pageBuilder.style.arrange"));
  const direction = useStyleField("flexDirection", text("pageBuilder.style.arrange"));
  const columns = useStyleField("gridTemplateColumns", text("pageBuilder.style.columns"));
  const arrangement: Arrangement =
    display.value === "grid"
      ? "grid"
      : display.value === "flex"
        ? direction.value === "row"
          ? "row"
          : "stack"
        : "normal";
  const label = text("pageBuilder.style.arrange");

  const arrange = (next: Arrangement) => {
    if (next === "stack") change({ display: "flex", flexDirection: "column" }, label);
    if (next === "row") change({ display: "flex", flexDirection: "row", flexWrap: "wrap" }, label);
    if (next === "grid")
      change(
        { display: "grid", gridTemplateColumns: columns.value ?? "repeat(2, minmax(0, 1fr))" },
        label,
      );
    if (next === "normal") change({ display: undefined, flexDirection: undefined }, label);
  };
  const columnCount = Number(/^repeat\((\d+)/.exec(columns.value ?? "")?.[1] ?? 0);

  return (
    <PanelSection
      title={text("pageBuilder.style.layout")}
      sectionId="layout"
      summary={layoutSummary(read, text)}
    >
      <ChoiceGroup<Arrangement>
        label={label}
        value={arrangement}
        onChange={arrange}
        choices={[
          { value: "stack", label: text("pageBuilder.style.stack"), icon: ArrowDown },
          { value: "row", label: text("pageBuilder.style.row"), icon: ArrowRight },
          { value: "grid", label: text("pageBuilder.style.grid"), icon: Grid3x3 },
          { value: "normal", label: text("pageBuilder.style.normal"), icon: Square },
        ]}
      />
      {arrangement === "grid" && (
        <ChoiceGroup
          label={text("pageBuilder.style.columns")}
          value={String(columnCount)}
          onChange={(count) => columns.set(`repeat(${count}, minmax(0, 1fr))`)}
          choices={["1", "2", "3", "4", "6"].map((count) => ({ value: count, label: count }))}
        />
      )}
      {arrangement !== "normal" && <AlignmentPad isRow={arrangement === "row"} />}
      {arrangement !== "normal" && (
        <StyleChips
          properties={["gap"]}
          label={text("pageBuilder.style.gap")}
          choices={tokenChips(spacingTokens.slice(1, 8), text("pageBuilder.style.none"))}
        />
      )}
      {advanced && (
        <div className="grid grid-cols-2 gap-2">
          <StyleSelect
            property="display"
            label={text("pageBuilder.style.display")}
            choices={["block", "flex", "grid", "inline", "inline-block", "inline-flex", "none"].map(
              (value) => ({ value, label: value }),
            )}
          />
          <StyleSelect
            property="flexWrap"
            label={text("pageBuilder.style.wrap")}
            choices={[
              { value: "wrap", label: text("pageBuilder.style.wrapYes") },
              { value: "nowrap", label: text("pageBuilder.style.wrapNo") },
            ]}
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
          <StyleTextInput
            property="order"
            label={text("pageBuilder.style.order")}
            placeholder="0"
          />
          <StyleTextInput
            property="flexGrow"
            label={text("pageBuilder.style.grow")}
            placeholder="0"
          />
          <StyleTextInput property="flexBasis" label={text("pageBuilder.style.basis")} />
        </div>
      )}
    </PanelSection>
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
