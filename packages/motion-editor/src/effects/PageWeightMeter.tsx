import type { PageWeight } from "@lintel/motion/effects";
import { Gauge, TriangleAlert } from "lucide-react";
import type { MotionEditorStringKey } from "../strings/motionEditorStrings.js";
import { useTranslate } from "../strings/translate.js";

/** "Effects: 3, adding 14 kB", and a plain warning for each heavy combination. */
export function formatKilobytes(bytes: number): string {
  return `${bytes < 10240 ? (bytes / 1024).toFixed(1) : Math.round(bytes / 1024)} kB`;
}

export function PageWeightMeter({ weight }: { weight: PageWeight }) {
  const t = useTranslate();
  return (
    <section
      aria-label={t("motionEditor.weight.title")}
      className="flex flex-col gap-2 rounded-card bg-fill/60 p-3"
    >
      <p role="status" className="flex items-center gap-2 text-footnote text-label">
        <Gauge aria-hidden="true" className="size-4 text-label-secondary" />
        {weight.effectCount === 0 && weight.bytes === 0
          ? t("motionEditor.weight.nothing")
          : t("motionEditor.weight.summary", {
              count: weight.effectCount,
              size: formatKilobytes(weight.bytes),
            })}
      </p>
      {weight.warnings.map((warning) => (
        <p
          key={warning}
          className="flex gap-2 rounded-control bg-warning/12 px-2.5 py-2 text-caption text-warning"
        >
          <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          {t(`motionEditor.weight.warning.${warning}` as MotionEditorStringKey)}
        </p>
      ))}
    </section>
  );
}
