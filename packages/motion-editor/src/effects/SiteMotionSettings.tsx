import {
  defaultCursorPicture,
  defaultCursorWordLook,
  largeCursorPictureBytes,
  type CursorPicture,
  type CursorWordLook,
  type SiteEffectSettings,
} from "@lintel/motion/effects";
import { useState } from "react";
import { Button } from "../controls/Button.js";
import { CollapsibleGroup } from "../controls/CollapsibleGroup.js";
import { Select, TextInput } from "../controls/Field.js";
import { SegmentedControl } from "../controls/SegmentedControl.js";
import { Slider } from "../controls/Slider.js";
import { TranslateProvider, useTranslate, type Translate } from "../strings/translate.js";
import { CursorLookFields, type CursorColourSwatch } from "./CursorLookFields.js";
import { CursorPreview } from "./CursorPreview.js";
import { formatKilobytes } from "./PageWeightMeter.js";

/** Opens the app's media library; resolves with the chosen picture, or null if cancelled. */
export type CursorPicturePicker = (request: {
  label: string;
  currentAssetId: string | null;
}) => Promise<{ assetId: string | null; src: string; bytes?: number } | null>;

/**
 * Motion across the whole site that belongs with the design: smooth scrolling and the
 * cursor. Page transitions and the first-visit intro are set with the rest of the site's
 * look, in the admin's Settings → Your website, and this says so.
 */
interface SiteMotionSettingsProps {
  value: SiteEffectSettings;
  onChange: (value: SiteEffectSettings) => void;
  translate?: Translate;
  /** Opens the media library for "Your own picture"; without it, an address is typed. */
  pickPicture?: CursorPicturePicker;
  /** The site's colours for the cursor's word; the theme's when left out. */
  colours?: readonly CursorColourSwatch[];
}

export function SiteMotionSettings(props: SiteMotionSettingsProps) {
  return (
    <TranslateProvider translate={props.translate}>
      <Settings {...props} />
    </TranslateProvider>
  );
}

function ColourWell({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-caption font-medium text-label-secondary">
      {label}
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-12 cursor-pointer rounded-control bg-fill p-0.5 focus-visible:focus-ring"
      />
    </label>
  );
}

function Settings({ value, onChange, pickPicture, colours }: SiteMotionSettingsProps) {
  const t = useTranslate();
  const [wordOpen, setWordOpen] = useState(false);
  // Settings saved before the cursor could be designed have no word look or picture.
  const cursor = {
    ...value.cursor,
    word: value.cursor.word ?? defaultCursorWordLook,
    picture: value.cursor.picture ?? defaultCursorPicture,
  };
  const wordChanged = (Object.keys(defaultCursorWordLook) as Array<keyof CursorWordLook>).some(
    (part) => cursor.word[part] !== defaultCursorWordLook[part],
  );
  // Settings saved before smooth scrolling existed don't have it.
  const smoothScroll = value.smoothScroll ?? { strength: "off" as const };
  const cursorColourChoice =
    cursor.colour === "text" || cursor.colour === "brand" ? cursor.colour : "own";
  const set = <Key extends keyof SiteEffectSettings>(
    key: Key,
    change: Partial<SiteEffectSettings[Key]>,
  ) => onChange({ ...value, [key]: { ...value[key], ...change } });
  const setPicture = (change: Partial<CursorPicture>) =>
    set("cursor", { picture: { ...cursor.picture, ...change } });
  return (
    <section aria-labelledby="site-motion-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 id="site-motion-title" className="text-headline text-label">
          {t("motionEditor.site.title")}
        </h3>
        <p className="text-footnote text-label-secondary">{t("motionEditor.site.description")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <span aria-hidden="true" className="text-caption font-medium text-label-secondary">
          {t("motionEditor.site.smoothScroll")}
        </span>
        <SegmentedControl
          label={t("motionEditor.site.smoothScroll")}
          value={smoothScroll.strength}
          onChange={(strength) => onChange({ ...value, smoothScroll: { strength } })}
          options={(["off", "gentle", "strong"] as const).map((strength) => ({
            value: strength,
            label: t(`motionEditor.site.smoothScroll.${strength}`),
          }))}
        />
        {smoothScroll.strength !== "off" && (
          <p className="text-caption text-label-tertiary">
            {t("motionEditor.site.smoothScroll.note")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Select
          label={t("motionEditor.site.cursor")}
          value={cursor.style}
          onChange={(event) =>
            set("cursor", { style: event.target.value as SiteEffectSettings["cursor"]["style"] })
          }
          options={[
            { value: "none", label: t("motionEditor.site.cursor.none") },
            { value: "dot", label: t("motionEditor.site.cursor.dot") },
            { value: "ring", label: t("motionEditor.site.cursor.ring") },
            { value: "ring-and-dot", label: t("motionEditor.site.cursor.ringAndDot") },
            { value: "blend", label: t("motionEditor.site.cursor.blend") },
            { value: "picture", label: t("motionEditor.site.cursor.picture") },
          ]}
        />
        {cursor.style === "picture" && (
          <>
            <PictureField picture={cursor.picture} pick={pickPicture} onChange={setPicture} />
            {cursor.picture.src && (
              <>
                <Slider
                  label={t("motionEditor.site.cursor.picture.size")}
                  value={cursor.picture.size}
                  min={16}
                  max={96}
                  step={2}
                  displayValue={`${cursor.picture.size} px`}
                  onChange={(size) => setPicture({ size })}
                />
                <div className="flex flex-col gap-2">
                  <span
                    aria-hidden="true"
                    className="text-caption font-medium text-label-secondary"
                  >
                    {t("motionEditor.site.cursor.picture.point")}
                  </span>
                  <SegmentedControl
                    label={t("motionEditor.site.cursor.picture.point")}
                    value={cursor.picture.point}
                    onChange={(point) => setPicture({ point })}
                    options={[
                      {
                        value: "centre" as const,
                        label: t("motionEditor.site.cursor.picture.point.centre"),
                      },
                      {
                        value: "top-left" as const,
                        label: t("motionEditor.site.cursor.picture.point.topLeft"),
                      },
                    ]}
                  />
                </div>
              </>
            )}
          </>
        )}
        {cursor.style !== "none" && cursor.style !== "picture" && (
          <>
            <Select
              label={t("motionEditor.site.cursor.trail")}
              value={cursor.trail}
              onChange={(event) =>
                set("cursor", {
                  trail: event.target.value as SiteEffectSettings["cursor"]["trail"],
                })
              }
              options={(["none", "dots", "line", "comet"] as const).map((trail) => ({
                value: trail,
                label: t(`motionEditor.site.cursor.trail.${trail}`),
              }))}
            />
            <Select
              label={t("motionEditor.site.cursor.colour")}
              value={cursorColourChoice}
              onChange={(event) =>
                set("cursor", {
                  colour: event.target.value === "own" ? "#111111" : event.target.value,
                })
              }
              options={(["text", "brand", "own"] as const).map((choice) => ({
                value: choice,
                label: t(`motionEditor.site.cursor.colour.${choice}`),
              }))}
            />
            {cursorColourChoice === "own" && (
              <ColourWell
                label={t("motionEditor.site.cursor.ownColour")}
                value={cursor.colour}
                onChange={(colour) => set("cursor", { colour })}
              />
            )}
            <Slider
              label={t("motionEditor.site.cursor.size")}
              value={cursor.size}
              min={8}
              max={96}
              step={2}
              displayValue={`${cursor.size} px`}
              onChange={(size) => set("cursor", { size })}
            />
          </>
        )}
        {cursor.style !== "none" && (
          <p className="text-caption text-label-tertiary">{t("motionEditor.site.cursor.note")}</p>
        )}
        <CollapsibleGroup
          title={t("motionEditor.site.cursor.word")}
          summary={t(
            wordChanged
              ? "motionEditor.site.cursor.word.changed"
              : "motionEditor.site.cursor.word.standard",
          )}
          isOpen={wordOpen}
          onToggle={() => setWordOpen((open) => !open)}
        >
          <CursorLookFields
            blank="auto"
            colours={colours}
            value={cursor.word}
            onChange={(word) =>
              set("cursor", { word: word as SiteEffectSettings["cursor"]["word"] })
            }
          />
        </CollapsibleGroup>
        <CursorPreview cursor={cursor} />
      </div>

      <p className="text-caption text-label-tertiary">{t("motionEditor.site.elsewhere")}</p>
    </section>
  );
}

/** The cursor's own picture: a thumbnail, a button to the media library, and a note when large. */
function PictureField({
  picture,
  pick,
  onChange,
}: {
  picture: CursorPicture;
  pick: CursorPicturePicker | undefined;
  onChange: (change: Partial<CursorPicture>) => void;
}) {
  const t = useTranslate();
  const label = t("motionEditor.site.cursor.picture.field");
  if (!pick) {
    return (
      <TextInput
        label={t("motionEditor.site.cursor.picture.address")}
        value={picture.src}
        onChange={(event) => onChange({ src: event.target.value, assetId: "", bytes: 0 })}
      />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption font-medium text-label-secondary">{label}</span>
      <div className="flex items-center gap-3">
        {picture.src && (
          <img
            src={picture.src}
            alt=""
            className="size-12 shrink-0 rounded-control bg-fill object-contain p-1.5"
          />
        )}
        <Button
          onClick={async () => {
            const picked = await pick({ label, currentAssetId: picture.assetId || null });
            if (picked) {
              onChange({
                assetId: picked.assetId ?? "",
                src: picked.src,
                bytes: picked.bytes ?? 0,
              });
            }
          }}
          className="px-3"
        >
          {t(
            picture.src
              ? "motionEditor.site.cursor.picture.change"
              : "motionEditor.site.cursor.picture.choose",
          )}
        </Button>
      </div>
      {!picture.src && (
        <p className="text-caption text-label-tertiary">
          {t("motionEditor.site.cursor.picture.none")}
        </p>
      )}
      {picture.bytes > largeCursorPictureBytes && (
        <p role="status" className="text-caption text-warning">
          {t("motionEditor.site.cursor.picture.large", { size: formatKilobytes(picture.bytes) })}
        </p>
      )}
    </div>
  );
}
