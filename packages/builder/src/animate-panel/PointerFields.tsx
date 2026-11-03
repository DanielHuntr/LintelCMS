import type { NodeEffect } from "@lintel/builder-model";
import { cursorWordEffectId, hoverPictureEffectId } from "@lintel/motion/effects";
import { useBuilderText } from "../i18n/builder-text.js";
import {
  ChoiceField,
  ImageField,
  type ImagePicker,
  TextInputField,
  ToggleField,
} from "../panels/content-fields.js";

/** The effects these fields set, which the Motion panel's list leaves out. */
export const pointerFieldEffectIds: ReadonlySet<string> = new Set([
  cursorWordEffectId,
  hoverPictureEffectId,
]);

const readyWords = ["view", "open", "drag", "play", "read"] as const;

interface PointerFieldsProps {
  effects: readonly NodeEffect[];
  onChange: (effects: NodeEffect[]) => void;
  pickImage: ImagePicker | undefined;
}

/**
 * Two touches for when a mouse is over the element: a short word the cursor shows ("View",
 * "Drag") and a picture that follows the pointer. Each is one choice; they're saved as the
 * element's `cursor-word` and `hover-picture` effects, so they load only where used.
 */
export function PointerFields({ effects, onChange, pickImage }: PointerFieldsProps) {
  const text = useBuilderText();
  const word = effects.find((effect) => effect.effect === cursorWordEffectId);
  const picture = effects.find((effect) => effect.effect === hoverPictureEffectId);
  const wordText = typeof word?.params.text === "string" ? word.params.text : "";
  const pictureSrc = typeof picture?.params.src === "string" ? picture.params.src : "";
  const readyWord = readyWords.find(
    (ready) => text(`pageBuilder.animate.pointer.word.${ready}`) === wordText,
  );
  const wordChoice = !word ? "none" : (readyWord ?? "own");

  const replace = (id: string, next: NodeEffect | null) => {
    const others = effects.filter((effect) => effect.effect !== id);
    onChange(next ? [...others, next] : others);
  };
  const setWord = (value: string) =>
    replace(
      cursorWordEffectId,
      value === "" && wordChoice !== "own"
        ? null
        : { effect: cursorWordEffectId, params: { text: value.slice(0, 16) } },
    );

  return (
    <section
      aria-labelledby="lintel-pointer-fields"
      className="flex flex-col gap-3 hairline-top px-4 py-4"
    >
      <h3 id="lintel-pointer-fields" className="text-footnote font-semibold text-label">
        {text("pageBuilder.animate.pointer.title")}
      </h3>
      <ChoiceField
        label={text("pageBuilder.animate.pointer.word")}
        value={wordChoice}
        choices={(["none", ...readyWords, "own"] as const).map((choice) => ({
          value: choice,
          label: text(`pageBuilder.animate.pointer.word.${choice}`),
        }))}
        onChange={(choice) => {
          if (choice === "none") replace(cursorWordEffectId, null);
          else if (choice === "own")
            replace(cursorWordEffectId, { effect: cursorWordEffectId, params: { text: "" } });
          else
            setWord(
              text(`pageBuilder.animate.pointer.word.${choice as (typeof readyWords)[number]}`),
            );
        }}
      />
      {wordChoice === "own" && (
        <TextInputField
          label={text("pageBuilder.animate.pointer.ownWord")}
          value={wordText}
          onChange={setWord}
        />
      )}
      <ToggleField
        label={text("pageBuilder.animate.pointer.picture")}
        value={picture !== undefined}
        onChange={(on) =>
          replace(
            hoverPictureEffectId,
            on ? { effect: hoverPictureEffectId, params: { src: "", size: "medium" } } : null,
          )
        }
      />
      {picture && (
        <ImageField
          label={text("pageBuilder.animate.pointer.pictureField")}
          value={{ src: pictureSrc, alt: "", assetId: null }}
          pickImage={pickImage}
          onChange={(picked) =>
            replace(hoverPictureEffectId, {
              effect: hoverPictureEffectId,
              params: { ...picture.params, src: picked.src },
            })
          }
        />
      )}
      {(word || picture) && (
        <p className="text-caption text-label-tertiary">
          {text("pageBuilder.animate.pointer.note")}
        </p>
      )}
    </section>
  );
}
