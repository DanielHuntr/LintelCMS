import { findPreset, type MotionPreset } from "@lintel/motion/presets";
import { PreviewSample } from "@lintel/motion-editor";
import { t } from "../../i18n/strings.js";
import { useMountedMotion } from "./useMountedMotion.js";

/** Presets mounted on real elements down a long page, so scroll and hover can be tried for real. */
const showcased = [
  "words-rise",
  "stagger-up",
  "parallax-slow",
  "hover-lift",
  "hover-tilt",
  "hover-magnetic",
  "hover-underline",
  "mask-reveal-up",
  "letters-drop",
  "section-iris",
  "scroll-grow",
  "blur-in",
];

function ShowcaseItem({ preset }: { preset: MotionPreset }) {
  const rootRef = useMountedMotion(preset.spec);
  return (
    <figure className="flex flex-col items-center gap-4 rounded-panel bg-surface px-6 py-14 hairline-ring">
      <PreviewSample sample={preset.preview.sample} rootRef={rootRef} size="large" />
      <figcaption className="text-center">
        <span className="block text-headline text-label">{preset.name}</span>
        <span className="text-footnote text-label-secondary">{preset.description}</span>
      </figcaption>
    </figure>
  );
}

export function PresetShowcase() {
  const presets = showcased.flatMap((id) => findPreset(id) ?? []);
  const progressRef = useMountedMotion(findPreset("progress-bar")?.spec ?? null);
  return (
    <section aria-labelledby="motion-showcase" className="flex flex-col gap-6">
      <div aria-hidden="true" className="fixed inset-x-0 top-0 z-20 h-1">
        <div ref={progressRef} className="h-full bg-accent-fill" />
      </div>
      <div>
        <h2 id="motion-showcase" className="text-title text-label">
          {t("designReview.motion.showcase")}
        </h2>
        <p className="text-body text-label-secondary">{t("designReview.motion.showcaseIntro")}</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {presets.map((preset) => (
          <ShowcaseItem key={preset.id} preset={preset} />
        ))}
      </div>
    </section>
  );
}
