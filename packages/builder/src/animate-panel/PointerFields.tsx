import type { NodeEffect } from "@lintel/builder-model";
import {
  cursorOverEffectId,
  cursorWordEffectId,
  hoverPictureEffectId,
  largeCursorPictureBytes,
} from "@lintel/motion/effects";
import { CursorLookFields, type CursorLookValue, type Translate } from "@lintel/motion-editor";
import { ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import {
  ChoiceField,
  ImageField,
  type ImagePicker,
  TextInputField,
} from "../panels/content-fields.js";
import { useCursorColourSwatches } from "./cursor-colours.js";

/** The effects these fields set, which the Motion panel's list leaves out. */
export const pointerFieldEffectIds: ReadonlySet<string> = new Set([
  cursorWordEffectId,
  hoverPictureEffectId,
  cursorOverEffectId,
]);

const readyWords = ["view", "open", "drag", "play", "read"] as const;
const choices = ["none", "word", "follow", "grow", "picture", "hide", "normal"] as const;
type PointerChoice = (typeof choices)[number];
const overModes: ReadonlySet<string> = new Set(["grow", "picture", "hide", "normal"]);
const pictureSizes = { small: 24, medium: 32, large: 48 } as const;
type PictureSize = keyof typeof pictureSizes;
const pictureSizeNames = Object.keys(pictureSizes) as PictureSize[];

interface PointerFieldsProps {
  effects: readonly NodeEffect[];
  onChange: (effects: NodeEffect[]) => void;
  pickImage: ImagePicker | undefined;
  /** Whether the site has a custom cursor, which growing needs. */
  siteCursorOn?: boolean;
  motionText?: Translate;
}

const readString = (effect: NodeEffect | undefined, name: string): string => {
  const value = effect?.params[name];
  return typeof value === "string" ? value : "";
};

/**
 * What the pointer does over the element, as one choice: a short word on the cursor
 * ("View"), a picture that follows it, or a change to the site's cursor (it grows, becomes
 * a different picture, hides, or gives way to the normal pointer). Only the chosen
 * option's fields show. Each is saved as one effect (`cursor-word`, `hover-picture` or
 * `cursor-over`), so its code loads only where it's used.
 */
export function PointerFields({
  effects,
  onChange,
  pickImage,
  siteCursorOn = false,
  motionText,
}: PointerFieldsProps) {
  const text = useBuilderText();
  const colours = useCursorColourSwatches();
  const word = effects.find((effect) => effect.effect === cursorWordEffectId);
  const follow = effects.find((effect) => effect.effect === hoverPictureEffectId);
  const over = effects.find((effect) => effect.effect === cursorOverEffectId);
  const overMode = readString(over, "mode");
  // Older pages could have a word and a following picture both; the word shows here.
  const choice: PointerChoice = word
    ? "word"
    : follow
      ? "follow"
      : over && overModes.has(overMode)
        ? (overMode as PointerChoice)
        : "none";
  const wordText = readString(word, "text");
  const followAssetId = readString(follow, "assetId") || null;
  const readyWord = readyWords.find(
    (ready) => text(`pageBuilder.animate.pointer.word.${ready}`) === wordText,
  );
  const wordChoice = readyWord ?? "own";

  const others = effects.filter((effect) => !pointerFieldEffectIds.has(effect.effect));
  const setOnly = (next: NodeEffect | null) => onChange(next ? [...others, next] : others);
  const update = (id: string, params: NodeEffect["params"]) =>
    onChange([...effects.filter((effect) => effect.effect !== id), { effect: id, params }]);

  const choose = (next: PointerChoice) => {
    if (next === "none") setOnly(null);
    else if (next === "word")
      setOnly({
        effect: cursorWordEffectId,
        params: { text: text("pageBuilder.animate.pointer.word.view") },
      });
    else if (next === "follow")
      setOnly({ effect: hoverPictureEffectId, params: { src: "", size: "medium" } });
    else if (next === "picture")
      setOnly({
        effect: cursorOverEffectId,
        params: { mode: "picture", src: "", size: 32, point: "centre", bytes: 0 },
      });
    else setOnly({ effect: cursorOverEffectId, params: { mode: next } });
  };

  const setWord = (value: string) =>
    update(cursorWordEffectId, { ...word?.params, text: value.slice(0, 16) });
  const overBytes = typeof over?.params.bytes === "number" ? over.params.bytes : 0;

  return (
    <section
      aria-labelledby="lintel-pointer-fields"
      className="flex flex-col gap-3 hairline-top px-4 py-4"
    >
      <h3 id="lintel-pointer-fields" className="text-footnote font-semibold text-label">
        {text("pageBuilder.animate.pointer.title")}
      </h3>
      <ChoiceField
        label={text("pageBuilder.animate.pointer.choice")}
        value={choice}
        choices={choices.map((each) => ({
          value: each,
          label: text(`pageBuilder.animate.pointer.choice.${each}`),
        }))}
        onChange={(next) => choose(next as PointerChoice)}
      />

      {choice === "word" && word && (
        <>
          <ChoiceField
            label={text("pageBuilder.animate.pointer.word")}
            value={wordChoice}
            choices={([...readyWords, "own"] as const).map((each) => ({
              value: each,
              label: text(`pageBuilder.animate.pointer.word.${each}`),
            }))}
            onChange={(next) =>
              setWord(
                next === "own"
                  ? ""
                  : text(`pageBuilder.animate.pointer.word.${next as (typeof readyWords)[number]}`),
              )
            }
          />
          {wordChoice === "own" && (
            <TextInputField
              label={text("pageBuilder.animate.pointer.ownWord")}
              value={wordText}
              onChange={setWord}
            />
          )}
          <WordLook
            value={{
              background: readString(word, "background"),
              colour: readString(word, "colour"),
              size: readString(word, "size"),
              shape: readString(word, "shape"),
            }}
            colours={colours}
            motionText={motionText}
            onChange={(look) => update(cursorWordEffectId, { ...word.params, ...look })}
          />
        </>
      )}

      {choice === "follow" && follow && (
        <ImageField
          label={text("pageBuilder.animate.pointer.pictureField")}
          value={{ src: readString(follow, "src"), alt: "", assetId: followAssetId }}
          pickImage={pickImage}
          onChange={(picked) =>
            // The picture's id too, so the website asks for a smaller copy of it.
            update(hoverPictureEffectId, {
              ...follow.params,
              src: picked.src,
              assetId: picked.assetId ?? "",
            })
          }
        />
      )}

      {choice === "picture" && over && (
        <>
          <ImageField
            label={text("pageBuilder.animate.pointer.cursorPicture")}
            value={{ src: readString(over, "src"), alt: "", assetId: null }}
            pickImage={pickImage}
            onChange={(picked) =>
              update(cursorOverEffectId, {
                ...over.params,
                src: picked.src,
                bytes: picked.bytes ?? 0,
              })
            }
          />
          {overBytes > largeCursorPictureBytes && (
            <p role="status" className="text-caption text-warning">
              {text("pageBuilder.animate.pointer.pictureLarge", {
                size: `${Math.round(overBytes / 1024)} kB`,
              })}
            </p>
          )}
          <ChoiceField
            label={text("pageBuilder.animate.pointer.pictureSize")}
            value={
              pictureSizeNames.find((size) => pictureSizes[size] === over.params.size) ?? "medium"
            }
            choices={pictureSizeNames.map((size) => ({
              value: size,
              label: text(`pageBuilder.animate.pointer.pictureSize.${size}`),
            }))}
            onChange={(size) =>
              update(cursorOverEffectId, {
                ...over.params,
                size: pictureSizes[size as PictureSize],
              })
            }
          />
          <ChoiceField
            label={text("pageBuilder.animate.pointer.point")}
            value={readString(over, "point") || "centre"}
            choices={(["centre", "top-left"] as const).map((point) => ({
              value: point,
              label: text(`pageBuilder.animate.pointer.point.${point}`),
            }))}
            onChange={(point) => update(cursorOverEffectId, { ...over.params, point })}
          />
        </>
      )}

      {choice === "grow" && !siteCursorOn && (
        <p className="text-caption text-label-secondary">
          {text("pageBuilder.animate.pointer.needsSiteCursor")}
        </p>
      )}

      {choice !== "none" && (
        <p className="text-caption text-label-tertiary">
          {text("pageBuilder.animate.pointer.note")}
        </p>
      )}
    </section>
  );
}

/** "Change its look", closed until wanted (or open when the word already has its own look). */
function WordLook({
  value,
  colours,
  motionText,
  onChange,
}: {
  value: CursorLookValue;
  colours: ReturnType<typeof useCursorColourSwatches>;
  motionText: Translate | undefined;
  onChange: (value: CursorLookValue) => void;
}) {
  const text = useBuilderText();
  const contentId = useId();
  const [open, setOpen] = useState(() => Object.values(value).some((part) => part !== ""));
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen(!open)}
        className="-mx-1 flex items-center gap-1 self-start rounded-control px-1 text-footnote font-medium text-accent focus-visible:focus-ring"
      >
        <ChevronRight
          aria-hidden="true"
          className={`size-3.5 motion-safe:transition-transform ${open ? "rotate-90" : ""}`}
        />
        {text("pageBuilder.animate.pointer.changeLook")}
      </button>
      <div id={contentId} hidden={!open}>
        {open && (
          <CursorLookFields
            blank=""
            value={value}
            colours={colours}
            translate={motionText}
            onChange={onChange}
          />
        )}
      </div>
    </div>
  );
}
