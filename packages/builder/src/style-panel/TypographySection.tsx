import { colourTokens } from "@lintel/builder-model";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from "lucide-react";
import { useBuilderText } from "../i18n/builder-text.js";
import { ChoiceGroup, PanelSection } from "../ui/controls.js";
import { lookAlign, nearestSizeChip, useSelectedLook } from "./canvas-look.js";
import { useStyleField } from "./style-field.js";
import { textSummary } from "./style-summaries.js";
import { FontPicker } from "./FontPicker.js";
import { ColourPicker, StyleChips, StyleSelect, StyleTextInput } from "./StyleInputs.js";
import { AdvancedTextEffects, FluidSizeControl, OutlineChips } from "./TextEffects.js";
import { useStyleSummary } from "./summary-names.js";

/**
 * How text looks: font, size (or a size that grows with the screen), weight, alignment,
 * colour and outline, then the finer details and text effects in Advanced.
 */
export function TypographySection({ advanced }: { advanced: boolean }) {
  const text = useBuilderText();
  const { summary, linked } = useStyleSummary((read) => textSummary(read, text));
  const align = useStyleField("textAlign", text("pageBuilder.style.textAlign"));
  // While nothing is set, the choices show how the text really looks on the canvas.
  const look = useSelectedLook();
  const sizes = [undefined, "0.875rem", "1.25rem", "2rem", "3.5rem"];
  const weights = ["400", "500", "700"];
  return (
    <PanelSection
      title={text("pageBuilder.style.text")}
      sectionId="text"
      summary={summary}
      linked={linked}
    >
      <FontPicker />
      <StyleChips
        properties={["fontSize"]}
        label={text("pageBuilder.style.fontSize")}
        choices={[
          { value: undefined, label: text("pageBuilder.style.sizeNormal") },
          { value: "0.875rem", label: text("pageBuilder.style.sizeSmall") },
          { value: "1.25rem", label: text("pageBuilder.style.sizeLarge") },
          { value: "2rem", label: text("pageBuilder.style.sizeHuge") },
          { value: "3.5rem", label: text("pageBuilder.style.sizeGiant") },
        ]}
        lookValue={nearestSizeChip(look, sizes)}
      />
      <StyleChips
        properties={["fontWeight"]}
        label={text("pageBuilder.style.fontWeight")}
        choices={[
          { value: "400", label: text("pageBuilder.style.weightRegular") },
          { value: "500", label: text("pageBuilder.style.weightMedium") },
          { value: "700", label: text("pageBuilder.style.weightBold") },
        ]}
        lookValue={look && weights.includes(look.fontWeight) ? look.fontWeight : null}
      />
      <ChoiceGroup
        label={text("pageBuilder.style.textAlign")}
        value={align.value ?? lookAlign(look) ?? "left"}
        onChange={(value) => align.set(value)}
        iconsOnly
        choices={[
          { value: "left", label: text("pageBuilder.style.alignLeft"), icon: AlignLeft },
          { value: "center", label: text("pageBuilder.style.alignCentreText"), icon: AlignCenter },
          { value: "right", label: text("pageBuilder.style.alignRight"), icon: AlignRight },
          { value: "justify", label: text("pageBuilder.style.alignJustify"), icon: AlignJustify },
        ]}
      />
      {advanced && <FluidSizeControl />}
      <ColourPicker
        property="color"
        label={text("pageBuilder.style.textColour")}
        tokens={colourTokens}
      />
      {!advanced && <OutlineChips />}
      {advanced && <AdvancedTextEffects />}
      {advanced && (
        <div className="grid grid-cols-2 gap-2">
          <StyleTextInput
            property="fontSize"
            label={text("pageBuilder.style.fontSizeExact")}
            placeholder="1rem"
          />
          <StyleTextInput
            property="fontWeight"
            label={text("pageBuilder.style.fontWeightExact")}
            placeholder="400"
          />
          <StyleTextInput
            property="lineHeight"
            label={text("pageBuilder.style.lineHeight")}
            placeholder="1.5"
          />
          <StyleTextInput
            property="letterSpacing"
            label={text("pageBuilder.style.letterSpacing")}
            placeholder="0"
          />
          <StyleSelect
            property="textTransform"
            label={text("pageBuilder.style.textTransform")}
            choices={[
              { value: "none", label: text("pageBuilder.style.transformNone") },
              { value: "uppercase", label: text("pageBuilder.style.transformUpper") },
              { value: "lowercase", label: text("pageBuilder.style.transformLower") },
              { value: "capitalize", label: text("pageBuilder.style.transformCapitalise") },
            ]}
          />
          <StyleSelect
            property="textDecoration"
            label={text("pageBuilder.style.textDecoration")}
            choices={[
              { value: "none", label: text("pageBuilder.style.decorationNone") },
              { value: "underline", label: text("pageBuilder.style.decorationUnderline") },
              { value: "line-through", label: text("pageBuilder.style.decorationStrike") },
            ]}
          />
          <StyleSelect
            property="fontStyle"
            label={text("pageBuilder.style.fontStyle")}
            choices={[
              { value: "normal", label: text("pageBuilder.style.styleNormal") },
              { value: "italic", label: text("pageBuilder.style.styleItalic") },
            ]}
          />
        </div>
      )}
    </PanelSection>
  );
}
