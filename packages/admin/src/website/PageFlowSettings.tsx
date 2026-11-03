import {
  nearestPageTransitionSpeed,
  pageTransitionSpeeds,
  type PageTransitionSpeed,
  type SiteEffectSettings,
} from "@lintel/motion/effects";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { SelectField } from "../design/SelectField.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { PageFlowPreview } from "./PageFlowPreview.js";

/**
 * "Moving between pages" in Settings → Your website: how one page gives way to the next,
 * and an optional intro before the home page on someone's first visit. Two choices and a
 * live preview; speed and the intro's words and colours appear only once they matter.
 */

export type PageFlow = Pick<SiteEffectSettings, "pageTransition" | "intro">;

type TransitionStyle = PageFlow["pageTransition"]["style"];
type IntroStyle = PageFlow["intro"]["style"];

const transitionStyles: readonly TransitionStyle[] = ["none", "fade", "slide", "wipe", "zoom"];
const introStyles: readonly IntroStyle[] = ["none", "counter", "name", "logo", "curtain"];

interface PageFlowSettingsProps {
  value: PageFlow;
  onChange: (value: PageFlow) => void;
  disabled: boolean;
  siteName: string;
  logoUrl: string | null;
}

export function PageFlowSettings({
  value,
  onChange,
  disabled,
  siteName,
  logoUrl,
}: PageFlowSettingsProps) {
  const { pageTransition, intro } = value;
  const changeTransition = (changes: Partial<PageFlow["pageTransition"]>) =>
    onChange({ ...value, pageTransition: { ...pageTransition, ...changes } });
  const changeIntro = (changes: Partial<PageFlow["intro"]>) =>
    onChange({ ...value, intro: { ...intro, ...changes } });

  return (
    <section
      aria-labelledby="page-flow-heading"
      className="flex flex-col gap-6 rounded-card bg-surface p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="page-flow-heading" className="text-title-3 text-label">
          {t("pageFlow.heading")}
        </h2>
        <p className="text-footnote text-label-secondary">{t("pageFlow.hint")}</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <SelectField
            label={t("pageFlow.transition")}
            value={pageTransition.style}
            disabled={disabled}
            onValueChange={(style) => changeTransition({ style: style as TransitionStyle })}
            options={transitionStyles.map((style) => ({
              value: style,
              label: t(`pageFlow.transition.${style}`),
            }))}
          />
          {pageTransition.style !== "none" && (
            <div className="flex flex-col items-start gap-1.5">
              <span aria-hidden="true" className="text-footnote font-medium text-label">
                {t("pageFlow.speed")}
              </span>
              <SegmentedControl<PageTransitionSpeed>
                label={t("pageFlow.speed")}
                value={nearestPageTransitionSpeed(pageTransition.duration)}
                onChange={(speed) =>
                  !disabled && changeTransition({ duration: pageTransitionSpeeds[speed] })
                }
                options={(["quick", "steady", "slow"] as const).map((speed) => ({
                  value: speed,
                  label: t(`pageFlow.speed.${speed}`),
                }))}
              />
            </div>
          )}
          <SelectField
            label={t("pageFlow.intro")}
            value={intro.style}
            disabled={disabled}
            hint={intro.style === "none" ? undefined : t("pageFlow.intro.hint")}
            onValueChange={(style) => changeIntro({ style: style as IntroStyle })}
            options={introStyles.map((style) => ({
              value: style,
              label: t(`pageFlow.intro.${style}`),
            }))}
          />
          {intro.style === "logo" && !logoUrl && (
            <p className="-mt-3 text-footnote text-label-secondary">{t("pageFlow.intro.noLogo")}</p>
          )}
          {intro.style !== "none" && (
            <details className="group -mt-2">
              <summary className="cursor-pointer text-footnote font-medium text-accent focus-visible:focus-ring rounded-control w-fit">
                {t("pageFlow.intro.more")}
              </summary>
              <div className="mt-4 flex flex-col gap-4">
                {(intro.style === "name" || intro.style === "logo") && (
                  <TextField
                    label={t("pageFlow.intro.words")}
                    value={intro.text}
                    maxLength={60}
                    placeholder={siteName || t("pageFlow.intro.wordsPlaceholder")}
                    disabled={disabled}
                    onChange={(event) => changeIntro({ text: event.target.value })}
                  />
                )}
                <div className="flex flex-wrap gap-6">
                  <ColourWell
                    label={t("pageFlow.intro.background")}
                    value={intro.background}
                    disabled={disabled}
                    onChange={(background) => changeIntro({ background })}
                  />
                  <ColourWell
                    label={t("pageFlow.intro.colour")}
                    value={intro.colour}
                    disabled={disabled}
                    onChange={(colour) => changeIntro({ colour })}
                  />
                </div>
              </div>
            </details>
          )}
        </div>
        <PageFlowPreview value={value} siteName={siteName} logoUrl={logoUrl} />
      </div>
    </section>
  );
}

function ColourWell({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-footnote font-medium text-label">
      <input
        type="color"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-10 cursor-pointer rounded-control border border-separator bg-fill p-0.5 focus-visible:focus-ring"
      />
      {label}
    </label>
  );
}
