import {
  findShapePreset,
  parsePolygon,
  polygonValue,
  readUrlAddress,
  type ShapePreset,
  shapePresets,
  startingPolygon,
  urlLayer,
} from "@lintel/builder-model";
import { ImagePlus } from "lucide-react";
import { useBuilderText } from "../i18n/builder-text.js";
import { PanelSection } from "../ui/controls.js";
import { useDesignTools } from "./design-tools.js";
import { PolygonEditor } from "./PolygonEditor.js";
import { useStyleEditing, useStyleField, useStyleReader } from "./style-field.js";
import { StyleChips, StyleSelect, StyleTextInput } from "./StyleInputs.js";

/** Masks people ask for most: fading a picture out, or showing it through a soft circle. */
const maskPresets = {
  fadeBottom: "linear-gradient(to bottom, black 60%, transparent)",
  fadeEdges: "radial-gradient(ellipse at center, black 55%, transparent 75%)",
  fadeSides: "linear-gradient(to right, transparent, black 20%, black 80%, transparent)",
} as const;

/**
 * Cutting an element to a shape (`clip-path`) and masking it (`mask-image`). Simple has the
 * ready-made shapes and a polygon with draggable corners; Advanced adds the exact shape,
 * fading masks and masking with a picture from the media library (a logo, a brush stroke).
 * Shapes and masks change how it looks only: the content is still read in full.
 */
export function ShapeSection({ advanced }: { advanced: boolean }) {
  const text = useBuilderText();
  const read = useStyleReader();
  const label = text("pageBuilder.design.shape");
  const clip = useStyleField("clipPath", label);
  const polygon = parsePolygon(clip.value);
  const preset = findShapePreset(clip.value);
  const summary = [
    clip.value &&
      (preset
        ? text(`pageBuilder.design.shape.${preset}`)
        : text("pageBuilder.design.shape.custom")),
    read("maskImage") && text("pageBuilder.design.summary.masked"),
  ]
    .filter(Boolean)
    .join(" · ");
  const presetNames: ShapePreset[] = ["circle", "ellipse", "rounded", "diagonal", "slash", "arch"];

  return (
    <PanelSection
      title={text("pageBuilder.design.shapeAndMask")}
      sectionId="shape"
      summary={summary}
    >
      <StyleChips
        properties={["clipPath"]}
        label={label}
        choices={[
          { value: undefined, label: text("pageBuilder.style.none") },
          ...presetNames.map((name) => ({
            value: shapePresets[name],
            label: text(`pageBuilder.design.shape.${name}`),
          })),
          {
            value: polygon && !preset ? clip.value : polygonValue(startingPolygon),
            label: text("pageBuilder.design.shape.custom"),
          },
        ]}
      />
      {polygon && (
        <PolygonEditor
          label={text("pageBuilder.design.cornersLabel")}
          points={polygon}
          onChange={(points) => clip.set(polygonValue(points))}
        />
      )}
      {advanced && (
        <>
          <StyleTextInput
            property="clipPath"
            label={text("pageBuilder.design.shapeExact")}
            placeholder="circle(50%)"
          />
          <MaskControls />
        </>
      )}
    </PanelSection>
  );
}

function MaskControls() {
  const text = useBuilderText();
  const tools = useDesignTools();
  const { change } = useStyleEditing();
  const label = text("pageBuilder.design.mask");
  const mask = useStyleField("maskImage", label);
  const pictureAddress = mask.value ? readUrlAddress(mask.value) : null;

  const choosePicture = async () => {
    const picked = await tools.pickImage?.({ label, currentAssetId: null });
    if (!picked) return;
    change(
      {
        maskImage: urlLayer(picked.src),
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
      },
      label,
    );
  };

  return (
    <>
      <StyleChips
        properties={["maskImage"]}
        label={label}
        choices={[
          { value: undefined, label: text("pageBuilder.style.none") },
          { value: maskPresets.fadeBottom, label: text("pageBuilder.design.mask.fadeBottom") },
          { value: maskPresets.fadeSides, label: text("pageBuilder.design.mask.fadeSides") },
          { value: maskPresets.fadeEdges, label: text("pageBuilder.design.mask.fadeEdges") },
        ]}
      />
      {tools.pickImage && (
        <button
          type="button"
          onClick={() => void choosePicture()}
          className="flex h-8 items-center gap-1.5 self-start rounded-control bg-fill px-2.5 text-caption font-medium text-label hover:bg-fill-strong focus-visible:focus-ring"
        >
          <ImagePlus aria-hidden="true" className="size-3.5" />
          {pictureAddress
            ? text("pageBuilder.design.mask.changePicture")
            : text("pageBuilder.design.mask.usePicture")}
        </button>
      )}
      {mask.value && (
        <div className="grid grid-cols-2 gap-2">
          <StyleSelect
            property="maskSize"
            label={text("pageBuilder.design.maskSize")}
            choices={[
              { value: "contain", label: text("pageBuilder.style.fitContain") },
              { value: "cover", label: text("pageBuilder.style.fitCover") },
              { value: "100% 100%", label: text("pageBuilder.design.stretch") },
            ]}
          />
          <StyleSelect
            property="maskRepeat"
            label={text("pageBuilder.design.repeat")}
            choices={[
              { value: "no-repeat", label: text("pageBuilder.design.repeatNo") },
              { value: "repeat", label: text("pageBuilder.design.repeatYes") },
            ]}
          />
          <StyleTextInput
            property="maskPosition"
            label={text("pageBuilder.design.maskPosition")}
            placeholder="center"
          />
        </div>
      )}
    </>
  );
}
