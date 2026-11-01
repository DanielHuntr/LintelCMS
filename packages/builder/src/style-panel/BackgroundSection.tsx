import {
  type BackgroundLayer,
  backgroundLayerStyles,
  backgroundVideoTypes,
  colourTokens,
  gradientValue,
  overlayLayer,
  pictureLayer,
  readBackgroundLayers,
  type StyleDeclarations,
} from "@lintel/builder-model";
import { ArrowDown, ArrowUp, ImagePlus, Palette, Trash2 } from "lucide-react";
import { useBuilderText } from "../i18n/builder-text.js";
import { IconButton, Labelled, PanelSection } from "../ui/controls.js";
import { BackgroundVideoControls } from "./BackgroundVideoControls.js";
import { useDesignTools } from "./design-tools.js";
import { FocalPointPicker } from "./FocalPointPicker.js";
import { GradientEditor } from "./GradientEditor.js";
import { useStyleEditing, useStyleReader } from "./style-field.js";
import { backgroundSummary } from "./style-summaries.js";
import { ColourPicker, StyleSelect } from "./StyleInputs.js";

const overlays = {
  light: "rgb(0 0 0 / 0.2)",
  medium: "rgb(0 0 0 / 0.4)",
  strong: "rgb(0 0 0 / 0.6)",
} as const;

/**
 * What's behind the element: a colour, then any number of layers on top of it (pictures from
 * the media library, gradients, colour overlays), and for sections a video. Simple has the
 * colour, one picture with its focal point and how much to darken it; Advanced shows every
 * layer, gradients, how layers blend and text filled with the background.
 */
export function BackgroundSection({ advanced }: { advanced: boolean }) {
  const text = useBuilderText();
  const read = useStyleReader();
  const tools = useDesignTools();
  const { change } = useStyleEditing();
  const label = text("pageBuilder.style.background");
  const current: StyleDeclarations = {
    backgroundImage: read("backgroundImage"),
    backgroundSize: read("backgroundSize"),
    backgroundPosition: read("backgroundPosition"),
    backgroundRepeat: read("backgroundRepeat"),
    backgroundAttachment: read("backgroundAttachment"),
  };
  const layers = readBackgroundLayers(current);
  const unreadable = current.backgroundImage !== undefined && layers.length === 0;
  const save = (next: BackgroundLayer[]) => change(backgroundLayerStyles(next), label);
  const picture = layers.find((layer) => layer.kind === "picture");
  const overlay = layers[0]?.kind === "gradient" && picture ? layers[0] : undefined;
  const overlayColour =
    overlay?.kind === "gradient" ? overlay.gradient.stops[0]?.colour : undefined;

  const choosePicture = async (replace?: number) => {
    const picked = await tools.pickImage?.({
      label: text("pageBuilder.design.picture"),
      currentAssetId: null,
    });
    if (!picked) return;
    if (replace !== undefined) {
      save(
        layers.map((layer, index) =>
          index === replace && layer.kind === "picture" ? { ...layer, src: picked.src } : layer,
        ),
      );
    } else if (advanced) {
      save([...layers, pictureLayer(picked.src)]);
    } else {
      save([...layers.filter((layer) => layer.kind !== "picture"), pictureLayer(picked.src)]);
    }
  };
  const setOverlay = (colour: string | undefined) => {
    const rest = overlay ? layers.slice(1) : layers;
    save(colour ? [overlayLayer(colour), ...rest] : rest);
  };
  const showsVideo = backgroundVideoTypes.includes(tools.node.type);

  return (
    <PanelSection title={label} sectionId="background" summary={backgroundSummary(read)}>
      <ColourPicker
        property="backgroundColor"
        label={text("pageBuilder.style.backgroundColour")}
        tokens={colourTokens}
      />
      {!advanced && (
        <>
          {tools.pickImage && (
            <AddButton
              icon={ImagePlus}
              onClick={() => void choosePicture(picture ? layers.indexOf(picture) : undefined)}
            >
              {picture
                ? text("pageBuilder.design.changePicture")
                : text("pageBuilder.design.addPicture")}
            </AddButton>
          )}
          {picture?.kind === "picture" && (
            <>
              <FocalPointPicker
                label={text("pageBuilder.design.focalPoint")}
                src={picture.src}
                value={picture.position}
                onChange={(position) =>
                  save(
                    layers.map((layer) => (layer === picture ? { ...picture, position } : layer)),
                  )
                }
              />
              <Labelled label={text("pageBuilder.design.darken")}>
                {() => (
                  <div
                    role="group"
                    aria-label={text("pageBuilder.design.darken")}
                    className="flex flex-wrap gap-1"
                  >
                    {([undefined, "light", "medium", "strong"] as const).map((strength) => {
                      const colour = strength ? overlays[strength] : undefined;
                      return (
                        <button
                          key={strength ?? "none"}
                          type="button"
                          aria-pressed={overlayColour === colour}
                          onClick={() => setOverlay(colour)}
                          className="h-7 rounded-control bg-fill px-2.5 text-caption font-medium text-label aria-pressed:bg-accent-fill aria-pressed:text-on-accent focus-visible:focus-ring"
                        >
                          {text(
                            strength
                              ? `pageBuilder.design.darken.${strength}`
                              : "pageBuilder.style.none",
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </Labelled>
            </>
          )}
        </>
      )}
      {advanced && (
        <>
          {unreadable && (
            <p className="text-caption text-label-secondary">
              {text("pageBuilder.design.layersByHand")}
            </p>
          )}
          <ol className="flex flex-col gap-3" aria-label={text("pageBuilder.design.layers")}>
            {layers.map((layer, index) => (
              <LayerControls
                key={index}
                layer={layer}
                index={index}
                count={layers.length}
                onChange={(next) =>
                  save(layers.map((current, position) => (position === index ? next : current)))
                }
                onMove={(step) => {
                  const next = [...layers];
                  const [moved] = next.splice(index, 1);
                  if (moved) next.splice(index + step, 0, moved);
                  save(next);
                }}
                onRemove={() => save(layers.filter((_, position) => position !== index))}
                onChangePicture={() => void choosePicture(index)}
              />
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            {tools.pickImage && (
              <AddButton icon={ImagePlus} onClick={() => void choosePicture()}>
                {text("pageBuilder.design.addPicture")}
              </AddButton>
            )}
            <AddButton
              icon={Palette}
              onClick={() =>
                save([
                  ...layers,
                  {
                    kind: "gradient",
                    gradient: {
                      type: "linear",
                      angle: 180,
                      stops: [
                        { colour: "#7539fd", at: 0 },
                        { colour: "#f7c948", at: 100 },
                      ],
                    },
                  },
                ])
              }
            >
              {text("pageBuilder.design.addGradient")}
            </AddButton>
          </div>
          {layers.length > 0 && (
            <>
              <StyleSelect
                property="backgroundBlendMode"
                label={text("pageBuilder.design.blendLayers")}
                choices={blendModeChoices(text)}
              />
              <TextFillToggle />
            </>
          )}
        </>
      )}
      {showsVideo && <BackgroundVideoControls />}
    </PanelSection>
  );
}

function LayerControls({
  layer,
  index,
  count,
  onChange,
  onMove,
  onRemove,
  onChangePicture,
}: {
  layer: BackgroundLayer;
  index: number;
  count: number;
  onChange: (layer: BackgroundLayer) => void;
  onMove: (step: number) => void;
  onRemove: () => void;
  onChangePicture: () => void;
}) {
  const text = useBuilderText();
  const name =
    layer.kind === "picture"
      ? text("pageBuilder.design.layerPicture", { number: index + 1 })
      : text("pageBuilder.design.layerGradient", { number: index + 1 });
  return (
    <li className="flex flex-col gap-2 rounded-control p-2 hairline-ring">
      <div className="flex items-center gap-1">
        <span className="flex-1 text-caption font-semibold text-label">{name}</span>
        <IconButton
          icon={ArrowUp}
          size="small"
          label={text("pageBuilder.design.layerUp", { name })}
          disabled={index === 0}
          onClick={() => onMove(-1)}
        />
        <IconButton
          icon={ArrowDown}
          size="small"
          label={text("pageBuilder.design.layerDown", { name })}
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        />
        <IconButton
          icon={Trash2}
          size="small"
          label={text("pageBuilder.design.layerRemove", { name })}
          onClick={onRemove}
        />
      </div>
      {layer.kind === "gradient" ? (
        <GradientEditor
          gradient={layer.gradient}
          preview={gradientValue(layer.gradient)}
          onChange={(gradient) => onChange({ kind: "gradient", gradient })}
        />
      ) : (
        <>
          <FocalPointPicker
            label={text("pageBuilder.design.focalPoint")}
            src={layer.src}
            value={layer.position}
            onChange={(position) => onChange({ ...layer, position })}
          />
          <button
            type="button"
            onClick={onChangePicture}
            className="self-start text-caption text-accent hover:underline focus-visible:focus-ring"
          >
            {text("pageBuilder.design.changePicture")}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <PlainSelect
              label={text("pageBuilder.design.pictureSize")}
              value={layer.size}
              onChange={(size) => onChange({ ...layer, size })}
              choices={[
                { value: "cover", label: text("pageBuilder.style.fitCover") },
                { value: "contain", label: text("pageBuilder.style.fitContain") },
                { value: "auto", label: text("pageBuilder.design.sizeActual") },
              ]}
            />
            <PlainSelect
              label={text("pageBuilder.design.repeat")}
              value={layer.repeat}
              onChange={(repeat) => onChange({ ...layer, repeat })}
              choices={[
                { value: "no-repeat", label: text("pageBuilder.design.repeatNo") },
                { value: "repeat", label: text("pageBuilder.design.repeatYes") },
              ]}
            />
            <PlainSelect
              label={text("pageBuilder.design.scrolling")}
              value={layer.attachment}
              onChange={(attachment) => onChange({ ...layer, attachment })}
              choices={[
                { value: "scroll", label: text("pageBuilder.design.scrollsWithPage") },
                { value: "fixed", label: text("pageBuilder.design.staysStill") },
              ]}
            />
          </div>
        </>
      )}
    </li>
  );
}

function PlainSelect({
  label,
  value,
  onChange,
  choices,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  choices: ReadonlyArray<{ value: string; label: string }>;
}) {
  const known = choices.some((choice) => choice.value === value);
  return (
    <Labelled label={label}>
      {(id) => (
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-full min-w-0 rounded-control bg-fill px-2 text-footnote text-label focus-visible:focus-ring"
        >
          {!known && <option value={value}>{value}</option>}
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      )}
    </Labelled>
  );
}

/**
 * Text filled with the background (a photo or gradient inside the letters): the background
 * is clipped to the text and the text itself made see-through.
 */
function TextFillToggle() {
  const text = useBuilderText();
  const read = useStyleReader();
  const { change } = useStyleEditing();
  const label = text("pageBuilder.design.textFill");
  const isOn = read("backgroundClip") === "text";
  return (
    <label className="flex items-center gap-2 text-footnote text-label">
      <input
        type="checkbox"
        checked={isOn}
        onChange={(event) =>
          change(
            event.target.checked
              ? { backgroundClip: "text", color: "transparent" }
              : { backgroundClip: undefined, color: undefined },
            label,
          )
        }
        className="size-4 accent-[var(--color-accent-fill)]"
      />
      {label}
    </label>
  );
}

function AddButton({
  icon: Icon,
  onClick,
  children,
}: {
  icon: typeof ImagePlus;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 items-center gap-1.5 self-start rounded-control bg-fill px-2.5 text-caption font-medium text-label hover:bg-fill-strong focus-visible:focus-ring"
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {children}
    </button>
  );
}

/** The blend modes, in plain words. Shared by background layers and whole elements. */
export function blendModeChoices(text: ReturnType<typeof useBuilderText>) {
  return (
    [
      "normal",
      "multiply",
      "screen",
      "overlay",
      "darken",
      "lighten",
      "color-burn",
      "difference",
      "luminosity",
    ] as const
  ).map((mode) => ({ value: mode, label: text(`pageBuilder.design.blend.${mode}`) }));
}
