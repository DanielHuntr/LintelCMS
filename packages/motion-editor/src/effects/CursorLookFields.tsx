import type { CursorWordLook } from "@lintel/motion/effects";
import { Check, Pipette } from "lucide-react";
import { useId } from "react";
import { classNames } from "../controls/classNames.js";
import { SegmentedControl } from "../controls/SegmentedControl.js";
import { TranslateProvider, useTranslate, type Translate } from "../strings/translate.js";

/**
 * How the cursor's word looks: background, letters, size and shape. The site settings use
 * it for the site's look ("Automatic" follows the cursor), and the Animate tab for one
 * element's own look (left empty, each part follows the site).
 */

/** A colour on offer: what is saved (`var(--lintel-color-brand)` or a site colour) and how it shows. */
export interface CursorColourSwatch {
  value: string;
  label: string;
  /** CSS for the swatch itself, such as the theme colour's usual value. */
  swatch: string;
}

const themeColours = [
  ["text", "#1d1d1f"],
  ["background", "#ffffff"],
  ["surface", "#f5f5f7"],
  ["brand", "#7539fd"],
  ["accent", "#0a6fd6"],
] as const;

/** The theme's colours, for hosts that don't pass the site's own. */
export function themeCursorSwatches(t: Translate): CursorColourSwatch[] {
  return themeColours.map(([name, fallback]) => ({
    value: `var(--lintel-color-${name})`,
    label: t(`motionEditor.site.cursor.colourChoice.${name}`),
    swatch: `var(--lintel-color-${name}, ${fallback})`,
  }));
}

/** Every part as a string; "auto" (the site) or "" (an element) means "as it would be". */
export type CursorLookValue = Record<keyof CursorWordLook, string>;

interface CursorLookFieldsProps {
  value: CursorLookValue;
  onChange: (value: CursorLookValue) => void;
  /** "auto" for the site's look, "" for an element's, which follows the site's. */
  blank: "auto" | "";
  colours?: readonly CursorColourSwatch[];
  translate?: Translate;
}

export function CursorLookFields(props: CursorLookFieldsProps) {
  return (
    <TranslateProvider translate={props.translate}>
      <LookFields {...props} />
    </TranslateProvider>
  );
}

function LookFields({ value, onChange, blank, colours: ownColours }: CursorLookFieldsProps) {
  const t = useTranslate();
  const colours = ownColours ?? themeCursorSwatches(t);
  const set = (part: keyof CursorWordLook, next: string) => onChange({ ...value, [part]: next });
  const sizes = ["small", "medium", "large"] as const;
  const shapes = ["pill", "square", "circle"] as const;
  const asSite = { value: "", label: t("motionEditor.site.cursor.word.asSite") };
  return (
    <div className="flex flex-col gap-3">
      <ColourChoice
        label={t("motionEditor.site.cursor.word.background")}
        value={value.background}
        blank={blank}
        colours={colours}
        onChange={(next) => set("background", next)}
      />
      <ColourChoice
        label={t("motionEditor.site.cursor.word.letters")}
        value={value.colour}
        blank={blank}
        colours={colours}
        onChange={(next) => set("colour", next)}
      />
      <div className="flex flex-col gap-1.5">
        <span aria-hidden="true" className="text-caption font-medium text-label-secondary">
          {t("motionEditor.site.cursor.word.size")}
        </span>
        <SegmentedControl
          label={t("motionEditor.site.cursor.word.size")}
          value={value.size}
          onChange={(next) => set("size", next)}
          options={[
            ...(blank === "" ? [asSite] : []),
            ...sizes.map((size) => ({
              value: size as string,
              label: t(`motionEditor.site.cursor.word.size.${size}`),
            })),
          ]}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span aria-hidden="true" className="text-caption font-medium text-label-secondary">
          {t("motionEditor.site.cursor.word.shape")}
        </span>
        <SegmentedControl
          label={t("motionEditor.site.cursor.word.shape")}
          value={value.shape}
          onChange={(next) => set("shape", next)}
          options={[
            ...(blank === "" ? [asSite] : []),
            ...shapes.map((shape) => ({
              value: shape as string,
              label: t(`motionEditor.site.cursor.word.shape.${shape}`),
            })),
          ]}
        />
      </div>
    </div>
  );
}

/** The site's colours as swatches, after "Automatic" (or "The site's choice"), then a colour well. */
function ColourChoice({
  label,
  value,
  blank,
  colours,
  onChange,
}: {
  label: string;
  value: string;
  blank: "auto" | "";
  colours: readonly CursorColourSwatch[];
  onChange: (value: string) => void;
}) {
  const t = useTranslate();
  const labelId = useId();
  const isBlank = value === blank;
  const current = colours.find((colour) => colour.value === value);
  const picked = !isBlank && !current && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
  const blankLabel = t(
    blank === "auto"
      ? "motionEditor.site.cursor.colourChoice.auto"
      : "motionEditor.site.cursor.word.asSite",
  );
  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-caption font-medium text-label-secondary">
        {label}
        <span className="font-normal text-label-tertiary">
          {" · "}
          {isBlank ? blankLabel : (current?.label ?? picked)}
        </span>
      </span>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-pressed={isBlank}
          onClick={() => onChange(blank)}
          className={classNames(
            "h-6 rounded-full px-2.5 text-caption font-medium focus-visible:focus-ring",
            isBlank
              ? "bg-accent-fill text-on-accent"
              : "bg-fill text-label-secondary hover:bg-fill/70",
          )}
        >
          {blankLabel}
        </button>
        {colours.map((colour) => {
          const chosen = colour.value === value;
          return (
            <button
              key={colour.value}
              type="button"
              title={colour.label}
              aria-label={colour.label}
              aria-pressed={chosen}
              onClick={() => onChange(colour.value)}
              style={{ background: colour.swatch }}
              className="flex size-6 items-center justify-center rounded-full hairline-ring focus-visible:focus-ring"
            >
              {chosen && (
                <Check aria-hidden="true" className="size-3.5 text-white mix-blend-difference" />
              )}
            </button>
          );
        })}
        {/* A colour picked by hand: an eyedropper until one is picked, then that colour. */}
        <span
          style={picked ? { background: picked } : undefined}
          className="relative flex size-6 items-center justify-center rounded-full bg-fill text-label-secondary hairline-ring has-[:focus-visible]:focus-ring"
        >
          {picked ? (
            <Check aria-hidden="true" className="size-3.5 text-white mix-blend-difference" />
          ) : (
            <Pipette aria-hidden="true" className="size-3.5" />
          )}
          <input
            type="color"
            aria-label={t("motionEditor.site.cursor.colourChoice.pick")}
            title={t("motionEditor.site.cursor.colourChoice.pick")}
            value={picked ?? "#000000"}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </span>
      </div>
    </div>
  );
}
