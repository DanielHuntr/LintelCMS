import type { SiteEffectSettings } from "@lintel/motion";
import { Select, TextInput } from "../controls/Field.js";
import { SegmentedControl } from "../controls/SegmentedControl.js";
import { Slider } from "../controls/Slider.js";
import { TranslateProvider, useTranslate, type Translate } from "../strings/translate.js";

/**
 * Motion across the whole site: smooth scrolling, the page transition, the cursor and the
 * intro. Plain choices with sensible defaults; each says what visitors who prefer less
 * motion get.
 */
interface SiteMotionSettingsProps {
  value: SiteEffectSettings;
  onChange: (value: SiteEffectSettings) => void;
  translate?: Translate;
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

function Settings({ value, onChange }: SiteMotionSettingsProps) {
  const t = useTranslate();
  const { pageTransition, cursor, intro } = value;
  // Settings saved before smooth scrolling existed don't have it.
  const smoothScroll = value.smoothScroll ?? { strength: "off" as const };
  const cursorColourChoice =
    cursor.colour === "text" || cursor.colour === "brand" ? cursor.colour : "own";
  const set = <Key extends keyof SiteEffectSettings>(
    key: Key,
    change: Partial<SiteEffectSettings[Key]>,
  ) => onChange({ ...value, [key]: { ...value[key], ...change } });
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
          label={t("motionEditor.site.transition")}
          value={pageTransition.style}
          onChange={(event) =>
            set("pageTransition", {
              style: event.target.value as SiteEffectSettings["pageTransition"]["style"],
            })
          }
          options={(["none", "fade", "slide", "wipe", "zoom"] as const).map((style) => ({
            value: style,
            label: t(`motionEditor.site.transition.${style}`),
          }))}
        />
        {pageTransition.style !== "none" && (
          <Slider
            label={t("motionEditor.site.transition.duration")}
            value={pageTransition.duration}
            min={150}
            max={1200}
            step={50}
            displayValue={`${pageTransition.duration} ms`}
            onChange={(duration) => set("pageTransition", { duration })}
          />
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
          ]}
        />
        {cursor.style !== "none" && (
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
            <p className="text-caption text-label-tertiary">{t("motionEditor.site.cursor.note")}</p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Select
          label={t("motionEditor.site.intro")}
          value={intro.style}
          onChange={(event) =>
            set("intro", { style: event.target.value as SiteEffectSettings["intro"]["style"] })
          }
          options={(["none", "curtain", "counter", "name"] as const).map((style) => ({
            value: style,
            label: t(`motionEditor.site.intro.${style}`),
          }))}
        />
        {intro.style !== "none" && (
          <>
            {intro.style === "name" && (
              <TextInput
                label={t("motionEditor.site.intro.text")}
                value={intro.text}
                maxLength={60}
                onChange={(event) => set("intro", { text: event.target.value })}
              />
            )}
            <ColourWell
              label={t("motionEditor.site.intro.background")}
              value={intro.background}
              onChange={(background) => set("intro", { background })}
            />
            <ColourWell
              label={t("motionEditor.site.intro.colour")}
              value={intro.colour}
              onChange={(colour) => set("intro", { colour })}
            />
            <p className="text-caption text-label-tertiary">{t("motionEditor.site.intro.note")}</p>
          </>
        )}
      </div>
    </section>
  );
}
