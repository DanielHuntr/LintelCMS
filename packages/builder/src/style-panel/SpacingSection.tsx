import { spacingTokens, type StylePropertyName } from "@lintel/builder-model";
import { type ReactNode, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { classNames, PanelSection } from "../ui/controls.js";
import { normaliseTypedValue, useStyleField } from "./style-field.js";
import { spacingSummary } from "./style-summaries.js";
import { StyleChips, useSizeChips } from "./StyleInputs.js";
import { useStyleSummary } from "./summary-names.js";

const sides = ["Top", "Right", "Bottom", "Left"] as const;
type Side = (typeof sides)[number];

/**
 * Room around and inside an element. Simple mode offers sizes for the space inside; Advanced
 * shows the box model: margin outside, padding inside, one box per side, as in a browser's
 * developer tools.
 */
export function SpacingSection({ advanced }: { advanced: boolean }) {
  const text = useBuilderText();
  const { summary, linked } = useStyleSummary((read) => spacingSummary(read, text));
  const padding = sides.map((side) => `padding${side}` as StylePropertyName);
  const sizeChips = useSizeChips(
    [
      spacingTokens[3],
      spacingTokens[4],
      spacingTokens[5],
      spacingTokens[6],
      spacingTokens[7],
    ].filter((token) => token !== undefined),
    text("pageBuilder.style.none"),
  );
  return (
    <PanelSection
      title={text("pageBuilder.style.spacing")}
      sectionId="spacing"
      summary={summary}
      linked={linked}
    >
      <StyleChips
        properties={padding}
        label={text("pageBuilder.style.paddingAll")}
        choices={sizeChips}
      />
      {advanced && <BoxModel />}
    </PanelSection>
  );
}

function BoxModel() {
  const text = useBuilderText();
  return (
    <div
      className="flex flex-col gap-1"
      role="group"
      aria-label={text("pageBuilder.style.boxModel")}
    >
      <div className="relative rounded-control border border-dashed border-separator p-1.5">
        <span className="absolute top-1 inset-s-2 text-[10px] font-medium uppercase tracking-wide text-label-tertiary">
          {text("pageBuilder.style.margin")}
        </span>
        <SideInputs kind="margin">
          <div className="relative rounded-control bg-fill p-1.5">
            <span className="absolute top-1 inset-s-2 text-[10px] font-medium uppercase tracking-wide text-label-tertiary">
              {text("pageBuilder.style.padding")}
            </span>
            <SideInputs kind="padding">
              <div className="h-6 rounded bg-surface hairline-ring" />
            </SideInputs>
          </div>
        </SideInputs>
      </div>
    </div>
  );
}

function SideInputs({ kind, children }: { kind: "margin" | "padding"; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[3rem_1fr_3rem] grid-rows-[auto_1fr_auto] items-center gap-1 pt-3">
      <div />
      <SideInput kind={kind} side="Top" />
      <div />
      <SideInput kind={kind} side="Left" />
      {children}
      <SideInput kind={kind} side="Right" />
      <div />
      <SideInput kind={kind} side="Bottom" />
      <div />
    </div>
  );
}

const sideNames: Record<
  Side,
  | "pageBuilder.style.top"
  | "pageBuilder.style.right"
  | "pageBuilder.style.bottom"
  | "pageBuilder.style.left"
> = {
  Top: "pageBuilder.style.top",
  Right: "pageBuilder.style.right",
  Bottom: "pageBuilder.style.bottom",
  Left: "pageBuilder.style.left",
};

/** One side's value, shown short ("M" for a spacing token) and typed in full. */
function SideInput({ kind, side }: { kind: "margin" | "padding"; side: Side }) {
  const text = useBuilderText();
  const property = `${kind}${side}` as StylePropertyName;
  const label = text("pageBuilder.style.sideLabel", {
    kind: text(kind === "margin" ? "pageBuilder.style.margin" : "pageBuilder.style.padding"),
    side: text(sideNames[side]),
  });
  const field = useStyleField(property, label);
  const shown = shortValue(field.value);
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const value = normaliseTypedValue(property, draft);
    setDraft(null);
    if (value !== null && value !== field.value) field.set(value);
  };

  return (
    <input
      aria-label={label}
      title={field.value ?? text("pageBuilder.style.notSet")}
      value={draft ?? shown}
      placeholder="0"
      onFocus={() => setDraft(field.value ?? "")}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
        if (event.key === "Escape") setDraft(null);
      }}
      className={classNames(
        "h-6 w-full min-w-0 justify-self-center rounded bg-transparent text-center text-caption text-label hover:bg-fill-strong focus-visible:bg-surface focus-visible:focus-ring",
        field.isOverridden && "font-semibold text-accent",
      )}
    />
  );
}

/** "var(--lintel-space-4)" reads as "M", the token's label; anything else as typed. */
function shortValue(value: string | undefined): string {
  if (!value) return "";
  const token = spacingTokens.find((candidate) => value === `var(--${candidate.name})`);
  return token ? token.label : value;
}
