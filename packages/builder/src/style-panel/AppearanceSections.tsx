import { colourTokens, radiusTokens } from "@lintel/builder-model";
import { useBuilderText } from "../i18n/builder-text.js";
import { Labelled, PanelSection } from "../ui/controls.js";
import { useStyleField, useStyleReader } from "./style-field.js";
import { useDesignTools } from "./design-tools.js";
import { FocalPointPicker } from "./FocalPointPicker.js";
import {
  bordersSummary,
  effectsSummary,
  positionSummary,
  shadows,
  sizeSummary,
} from "./style-summaries.js";
import {
  ColourPicker,
  StyleChips,
  StyleSelect,
  StyleTextInput,
  tokenChips,
} from "./StyleInputs.js";
import { useStyleSummary } from "./summary-names.js";

/** Size, position, borders and effects. */

export function SizeSection() {
  const text = useBuilderText();
  const read = useStyleReader();
  const { node } = useDesignTools();
  const objectPosition = useStyleField("objectPosition", text("pageBuilder.design.objectPosition"));
  const pictureSrc =
    node.type === "image" && typeof node.props.src === "string" ? node.props.src : "";
  return (
    <PanelSection
      title={text("pageBuilder.style.size")}
      sectionId="size"
      summary={sizeSummary(read, text)}
    >
      <div className="grid grid-cols-2 gap-2">
        <StyleTextInput property="width" label={text("pageBuilder.style.width")} />
        <StyleTextInput property="height" label={text("pageBuilder.style.height")} />
        <StyleTextInput property="minWidth" label={text("pageBuilder.style.minWidth")} />
        <StyleTextInput
          property="maxWidth"
          label={text("pageBuilder.style.maxWidth")}
          placeholder={text("pageBuilder.style.none")}
        />
        <StyleTextInput property="minHeight" label={text("pageBuilder.style.minHeight")} />
        <StyleTextInput
          property="maxHeight"
          label={text("pageBuilder.style.maxHeight")}
          placeholder={text("pageBuilder.style.none")}
        />
        <StyleTextInput
          property="aspectRatio"
          label={text("pageBuilder.style.aspectRatio")}
          placeholder="16 / 9"
        />
        <StyleSelect
          property="objectFit"
          label={text("pageBuilder.style.objectFit")}
          choices={[
            { value: "cover", label: text("pageBuilder.style.fitCover") },
            { value: "contain", label: text("pageBuilder.style.fitContain") },
          ]}
        />
        <StyleTextInput
          property="objectPosition"
          label={text("pageBuilder.design.objectPosition")}
          placeholder="50% 50%"
        />
        <StyleSelect
          property="overflow"
          label={text("pageBuilder.style.overflow")}
          choices={[
            { value: "visible", label: text("pageBuilder.style.overflowVisible") },
            { value: "hidden", label: text("pageBuilder.style.overflowHidden") },
            { value: "auto", label: text("pageBuilder.style.overflowScroll") },
          ]}
        />
      </div>
      {pictureSrc && (
        <FocalPointPicker
          label={text("pageBuilder.design.objectFocus")}
          src={pictureSrc}
          value={objectPosition.value}
          onChange={objectPosition.set}
        />
      )}
    </PanelSection>
  );
}

export function PositionSection() {
  const text = useBuilderText();
  const read = useStyleReader();
  return (
    <PanelSection
      title={text("pageBuilder.style.position")}
      sectionId="position"
      summary={positionSummary(read, text)}
    >
      <div className="grid grid-cols-2 gap-2">
        <StyleSelect
          property="position"
          label={text("pageBuilder.style.positionType")}
          choices={[
            { value: "static", label: text("pageBuilder.style.positionNormal") },
            { value: "relative", label: text("pageBuilder.style.positionRelative") },
            { value: "absolute", label: text("pageBuilder.style.positionAbsolute") },
            { value: "sticky", label: text("pageBuilder.style.positionSticky") },
            { value: "fixed", label: text("pageBuilder.style.positionFixed") },
          ]}
        />
        <StyleTextInput
          property="zIndex"
          label={text("pageBuilder.style.zIndex")}
          placeholder="auto"
        />
        <StyleTextInput property="top" label={text("pageBuilder.style.top")} />
        <StyleTextInput property="right" label={text("pageBuilder.style.right")} />
        <StyleTextInput property="bottom" label={text("pageBuilder.style.bottom")} />
        <StyleTextInput property="left" label={text("pageBuilder.style.left")} />
      </div>
    </PanelSection>
  );
}

export function BordersSection({ advanced }: { advanced: boolean }) {
  const text = useBuilderText();
  const borders = useStyleSummary((read) => bordersSummary(read, text));
  return (
    <PanelSection
      title={text("pageBuilder.style.borders")}
      sectionId="borders"
      summary={borders.summary}
      linked={borders.linked}
    >
      <StyleChips
        properties={["borderRadius"]}
        label={text("pageBuilder.style.corners")}
        choices={[
          ...tokenChips(radiusTokens.slice(0, 3), text("pageBuilder.style.cornersSquare")),
          { value: "999px", label: text("pageBuilder.style.cornersRound") },
        ]}
      />
      {advanced && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <StyleTextInput
              property="borderWidth"
              label={text("pageBuilder.style.borderWidth")}
              placeholder="0"
            />
            <StyleSelect
              property="borderStyle"
              label={text("pageBuilder.style.borderStyle")}
              choices={[
                { value: "solid", label: text("pageBuilder.style.borderSolid") },
                { value: "dashed", label: text("pageBuilder.style.borderDashed") },
                { value: "dotted", label: text("pageBuilder.style.borderDotted") },
                { value: "none", label: text("pageBuilder.style.none") },
              ]}
            />
            <StyleTextInput
              property="borderRadius"
              label={text("pageBuilder.style.cornersExact")}
            />
          </div>
          <ColourPicker
            property="borderColor"
            label={text("pageBuilder.style.borderColour")}
            tokens={colourTokens}
          />
        </>
      )}
    </PanelSection>
  );
}

export function EffectsSection() {
  const text = useBuilderText();
  const read = useStyleReader();
  const opacity = useStyleField("opacity", text("pageBuilder.style.opacity"));
  const percent = Math.round(Number(opacity.value ?? 1) * 100);
  return (
    <PanelSection
      title={text("pageBuilder.style.effects")}
      sectionId="effects"
      summary={effectsSummary(read, text)}
    >
      <Labelled
        label={text("pageBuilder.style.opacity")}
        overridden={opacity.isOverridden ? text("pageBuilder.style.changedHere") : undefined}
        onReset={opacity.reset}
        resetLabel={text("pageBuilder.style.reset")}
      >
        {(id) => (
          <div className="flex items-center gap-2">
            <input
              id={id}
              type="range"
              min={0}
              max={100}
              step={5}
              value={Number.isFinite(percent) ? percent : 100}
              aria-valuetext={`${percent}%`}
              onChange={(event) =>
                opacity.set(
                  event.target.value === "100"
                    ? undefined
                    : String(Number(event.target.value) / 100),
                )
              }
              className="flex-1 accent-[var(--color-accent-fill)]"
            />
            <span className="w-9 text-end text-caption text-label-secondary">{percent}%</span>
          </div>
        )}
      </Labelled>
      <StyleChips
        properties={["boxShadow"]}
        label={text("pageBuilder.style.shadow")}
        choices={[
          { value: undefined, label: text("pageBuilder.style.none") },
          { value: shadows.soft, label: text("pageBuilder.style.shadowSoft") },
          { value: shadows.medium, label: text("pageBuilder.style.shadowMedium") },
          { value: shadows.strong, label: text("pageBuilder.style.shadowStrong") },
        ]}
      />
      <StyleSelect
        property="cursor"
        label={text("pageBuilder.style.cursor")}
        choices={[
          { value: "pointer", label: text("pageBuilder.style.cursorPointer") },
          { value: "default", label: text("pageBuilder.style.cursorDefault") },
        ]}
      />
    </PanelSection>
  );
}
