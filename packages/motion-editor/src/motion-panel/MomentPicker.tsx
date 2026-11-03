import {
  ArrowDownUp,
  ArrowUp,
  Infinity as Endless,
  MousePointer2,
  Pointer,
  type LucideIcon,
} from "lucide-react";
import type { KeyboardEvent } from "react";
import type { MotionEditorStringKey } from "../strings/motionEditorStrings.js";
import { useTranslate } from "../strings/translate.js";
import { motionMoments, type MotionMoment } from "./motionChoices.js";

export const momentIcons: Record<MotionMoment, LucideIcon> = {
  appears: ArrowUp,
  hover: MousePointer2,
  click: Pointer,
  scroll: ArrowDownUp,
  always: Endless,
};

/**
 * Each moment's colour, for the small tile beside a row: quiet, earthy tones that sit with the
 * admin's warm neutrals, each dark enough for a white icon on it in light and dark mode.
 */
export const momentColours: Record<MotionMoment, string> = {
  appears: "#4f6b78",
  hover: "#93652b",
  click: "#76586f",
  scroll: "#3f7466",
  always: "#66733a",
};

/**
 * The five moments as a radio group of small icon-over-word buttons, five across. The words
 * sit under the icons, so each has the full column and none is cut short in a narrow panel.
 * Arrow keys, Home and End move between them; with nothing chosen yet, Tab lands on the first.
 */
export function MomentPicker({
  value,
  onChange,
}: {
  value: MotionMoment | null;
  onChange: (moment: MotionMoment) => void;
}) {
  const t = useTranslate();
  function move(event: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
    // From the focused moment (the first, when none is chosen yet).
    const focused = (event.target as HTMLElement).dataset.moment;
    const at = Math.max(motionMoments.indexOf((focused ?? value) as MotionMoment), 0);
    const target =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? motionMoments.length - 1
          : step === undefined
            ? undefined
            : (at + step + motionMoments.length) % motionMoments.length;
    const next = target === undefined ? undefined : motionMoments[target];
    if (!next) return;
    event.preventDefault();
    onChange(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-moment="${next}"]`)?.focus();
  }
  return (
    <div
      role="radiogroup"
      aria-label={t("motionEditor.panel.moments")}
      onKeyDown={move}
      className="grid grid-cols-5 gap-0.5 rounded-control bg-fill p-0.5"
    >
      {motionMoments.map((moment, index) => {
        const Icon = momentIcons[moment];
        const checked = moment === value;
        return (
          <button
            key={moment}
            type="button"
            role="radio"
            data-moment={moment}
            aria-checked={checked}
            tabIndex={checked || (value === null && index === 0) ? 0 : -1}
            onClick={() => onChange(moment)}
            className="flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[calc(var(--radius-control)-2px)] px-0.5 py-1.5 text-label-secondary transition-colors duration-150 ease-standard hover:text-label focus-visible:focus-ring aria-checked:bg-surface aria-checked:text-label aria-checked:shadow-float"
          >
            <Icon aria-hidden="true" className="size-4" strokeWidth={2} />
            <span className="max-w-full text-[11px] leading-tight font-medium break-words">
              {t(`motionEditor.moment.${moment}` as MotionEditorStringKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
