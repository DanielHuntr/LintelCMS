import type { SiteEffectSettings } from "@lintel/motion";
import { Select } from "../controls/Field.js";
import { Slider } from "../controls/Slider.js";
import { TranslateProvider, useTranslate, type Translate } from "../strings/translate.js";

/**
 * Motion across the whole site that belongs with the design: the cursor. Page transitions
 * and the first-visit intro are set with the rest of the site's look, in the admin's
 * Settings → Your website, and this says so.
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
  const { cursor } = value;
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
            <ColourWell
              label={t("motionEditor.site.cursor.colour")}
              value={cursor.colour}
              onChange={(colour) => set("cursor", { colour })}
            />
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

      <p className="text-caption text-label-tertiary">{t("motionEditor.site.elsewhere")}</p>
    </section>
  );
}
