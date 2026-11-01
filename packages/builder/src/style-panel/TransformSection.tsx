import { parseSkew, skewValue } from "@lintel/builder-model";
import { useBuilderText } from "../i18n/builder-text.js";
import { classNames, inputClassName, Labelled, PanelSection } from "../ui/controls.js";
import { normaliseTypedValue, useStyleField, useStyleReader } from "./style-field.js";
import { StyleSlider, StyleTextInput } from "./StyleInputs.js";

/**
 * Turning, resizing, moving and slanting an element without changing the layout around it
 * (CSS `rotate`, `scale`, `translate` and `transform: skew()`). Simple has turn and size;
 * Advanced adds moving, slanting and the point it turns around. On the canvas, the round
 * handle above the selected element turns it too.
 */
export function TransformSection({ advanced }: { advanced: boolean }) {
  const text = useBuilderText();
  const read = useStyleReader();
  const summary = [
    read("rotate") && text("pageBuilder.design.summary.turned", { angle: read("rotate") ?? "" }),
    read("scale") && text("pageBuilder.design.summary.sized", { scale: read("scale") ?? "" }),
    (read("translate") || read("transform")) && text("pageBuilder.style.summary.custom"),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <PanelSection
      title={text("pageBuilder.design.transform")}
      sectionId="transform"
      summary={summary}
    >
      <StyleSlider
        property="rotate"
        label={text("pageBuilder.design.rotate")}
        min={-180}
        max={180}
        step={1}
        unit="deg"
        neutral={0}
      />
      <StyleSlider
        property="scale"
        label={text("pageBuilder.design.scale")}
        min={0.25}
        max={3}
        step={0.05}
        unit=""
        neutral={1}
      />
      <p className="text-caption text-label-tertiary">
        {text("pageBuilder.design.rotateHandleHint")}
      </p>
      {advanced && (
        <>
          <TranslateInputs />
          <SkewSliders />
          <OriginPad />
          <StyleTextInput
            property="transform"
            label={text("pageBuilder.design.transformExact")}
            placeholder="skew(-8deg, 0deg)"
          />
        </>
      )}
    </PanelSection>
  );
}

/** "Move across" and "Move down": the two halves of `translate`. */
function TranslateInputs() {
  const text = useBuilderText();
  const field = useStyleField("translate", text("pageBuilder.design.move"));
  const [across = "", down = ""] = (field.value ?? "").split(/\s+/);
  const commit = (nextAcross: string, nextDown: string) => {
    const x = normaliseTypedValue("left", nextAcross) ?? "0";
    const y = normaliseTypedValue("top", nextDown) ?? "0";
    field.set(x === "0" && y === "0" ? undefined : `${x} ${y}`);
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      <Labelled label={text("pageBuilder.design.moveAcross")}>
        {(id) => (
          <input
            id={id}
            key={`x-${field.value ?? ""}`}
            defaultValue={across === "0" ? "" : across}
            placeholder="0"
            onBlur={(event) => commit(event.target.value, down)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit(event.currentTarget.value, down);
            }}
            className={inputClassName}
          />
        )}
      </Labelled>
      <Labelled label={text("pageBuilder.design.moveDown")}>
        {(id) => (
          <input
            id={id}
            key={`y-${field.value ?? ""}`}
            defaultValue={down === "0" ? "" : down}
            placeholder="0"
            onBlur={(event) => commit(across, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit(across, event.currentTarget.value);
            }}
            className={inputClassName}
          />
        )}
      </Labelled>
    </div>
  );
}

/** Slant across and slant up and down, written as one `skew()`. */
function SkewSliders() {
  const text = useBuilderText();
  const field = useStyleField("transform", text("pageBuilder.design.skew"));
  const skew = parseSkew(field.value);
  if (!skew) return null;
  const slider = (axis: "x" | "y", label: string) => (
    <Labelled label={label}>
      {(id) => (
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="range"
            min={-45}
            max={45}
            step={1}
            value={skew[axis]}
            aria-valuetext={`${skew[axis]}°`}
            onChange={(event) => {
              const value = Number(event.target.value);
              field.set(axis === "x" ? skewValue(value, skew.y) : skewValue(skew.x, value));
            }}
            className="flex-1 accent-[var(--color-accent-fill)]"
          />
          <span className="w-10 text-end text-caption text-label-secondary">{skew[axis]}°</span>
        </div>
      )}
    </Labelled>
  );
  return (
    <>
      {slider("x", text("pageBuilder.design.skewAcross"))}
      {slider("y", text("pageBuilder.design.skewDown"))}
    </>
  );
}

const origins = [
  ["0% 0%", "50% 0%", "100% 0%"],
  ["0% 50%", "50% 50%", "100% 50%"],
  ["0% 100%", "50% 100%", "100% 100%"],
] as const;

/** Nine points: which point of the element it turns and grows around. */
function OriginPad() {
  const text = useBuilderText();
  const label = text("pageBuilder.design.origin");
  const field = useStyleField("transformOrigin", label);
  const current = field.value ?? "50% 50%";
  const names = [
    text("pageBuilder.style.alignStart"),
    text("pageBuilder.style.alignCentre"),
    text("pageBuilder.style.alignEnd"),
  ];
  return (
    <Labelled label={label}>
      {() => (
        <div
          role="radiogroup"
          aria-label={label}
          className="grid w-24 grid-cols-3 gap-1 rounded-control bg-fill p-1.5"
        >
          {origins.flatMap((row, rowIndex) =>
            row.map((value, columnIndex) => {
              const isCurrent = value === current;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={isCurrent}
                  aria-label={text("pageBuilder.style.alignPosition", {
                    across: names[columnIndex] ?? "",
                    down: names[rowIndex] ?? "",
                  })}
                  onClick={() => field.set(value === "50% 50%" ? undefined : value)}
                  className="flex aspect-square items-center justify-center rounded focus-visible:focus-ring"
                >
                  <span
                    className={classNames(
                      "rounded-full",
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
