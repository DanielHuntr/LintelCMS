import type { MotionSpec } from "@lintel/motion";
import { findPreset } from "@lintel/motion/presets";
import { MotionStudio } from "@lintel/motion-editor";
import { useCallback, useState } from "react";
import { BackLink } from "../../design/BackLink.js";
import { LargeTitle } from "../../design/LargeTitle.js";
import { t } from "../../i18n/strings.js";
import { LiveSample } from "./LiveSample.js";
import { PresetShowcase } from "./PresetShowcase.js";

const startingPreset = findPreset("fade-up");

/**
 * A development-only page for reviewing the animation studio: the studio itself, the
 * animation being edited playing on a real element, and presets on a long scrolling page.
 */
export function MotionReviewPage() {
  const [spec, setSpec] = useState<MotionSpec | null>(startingPreset?.spec ?? null);
  const [presetId, setPresetId] = useState(startingPreset?.id);
  const handleChange = useCallback((next: MotionSpec, nextPresetId: string | undefined) => {
    setSpec(next);
    setPresetId(nextPresetId);
  }, []);
  const sample = (presetId ? findPreset(presetId)?.preview.sample : undefined) ?? "card";

  return (
    <main className="min-h-screen bg-background px-10 pt-14 pb-24 text-label">
      <BackLink to="/design-system">{t("designReview.motion.backToDesignSystem")}</BackLink>
      <LargeTitle
        title={t("designReview.motion.title")}
        subtitle={t("designReview.motion.intro")}
      />
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-labelledby="motion-studio" className="flex min-w-0 flex-col gap-4">
          <h2 id="motion-studio" className="text-title">
            {t("designReview.motion.studio")}
          </h2>
          <MotionStudio
            initialSpec={spec}
            initialPresetId={presetId}
            onChange={handleChange}
            translate={t}
          />
        </section>
        <aside
          aria-labelledby="motion-on-a-page"
          className="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start"
        >
          <h2 id="motion-on-a-page" className="text-title">
            {t("designReview.motion.onAPage")}
          </h2>
          <p className="text-footnote text-label-secondary">
            {t("designReview.motion.onAPageIntro")}
          </p>
          <LiveSample spec={spec} sample={sample} />
          <details className="rounded-card bg-surface p-3 hairline-ring">
            <summary className="cursor-pointer text-footnote font-medium">
              {t("designReview.motion.spec")}
            </summary>
            <pre className="mt-2 max-h-72 overflow-auto text-caption text-label-secondary">
              {JSON.stringify(spec, null, 2)}
            </pre>
          </details>
        </aside>
      </div>
      <div className="mt-20">
        <PresetShowcase />
      </div>
    </main>
  );
}
