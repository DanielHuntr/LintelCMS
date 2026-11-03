import type { MotionSpec } from "@lintel/motion";
import { ChevronRight, LayoutGrid, SlidersHorizontal } from "lucide-react";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { SegmentedControl } from "../controls/SegmentedControl.js";
import { Slider } from "../controls/Slider.js";
import type { MotionEditorStringKey } from "../strings/motionEditorStrings.js";
import { useTranslate } from "../strings/translate.js";
import { MomentPicker } from "./MomentPicker.js";
import type { MotionChoice, MotionMoment } from "./motionChoices.js";
import { motionDemoCss } from "./motionDemos.js";
import { MotionTile } from "./MotionTile.js";
import {
  distanceForStartSize,
  growRange,
  quickControls,
  startSizeFor,
  type MotionFeel,
  type QuickChoice,
  type QuickSettings,
} from "./quickPicks.js";

/** The motion this screen added, and the settings it was given here. */
export interface QuickAdded {
  /** Where it is in the element's animations. */
  index: number;
  choice: MotionChoice;
  /** The tile's spec before the controls below are applied. */
  base: MotionSpec;
  settings: QuickSettings;
}

interface QuickMotionProps {
  moment: MotionMoment | null;
  tiles: readonly QuickChoice[];
  added: QuickAdded | null;
  /** The element has as many animations as it can take, so nothing can be added. */
  animationsFull: boolean;
  onMoment: (moment: MotionMoment) => void;
  onTile: (tile: QuickChoice) => void;
  /** `preview` plays it on the page: when a slider is let go, or the feel changes. */
  onSettings: (settings: QuickSettings, preview: boolean) => void;
  onCommit: () => void;
  onMoreSettings: () => void;
  onMoreEffects: () => void;
  onDone: () => void;
}

const formatNumber = (value: number) => value.toFixed(2).replace(/\.?0+$/, "") || "0";

/**
 * Adding motion without a wall of choices: choose when it moves and a good default is on the
 * element at once (and plays on the page). Below, a few small tiles that show the movement
 * itself, then the plain controls people reach for: how much, how fast, the feel, and when
 * it starts. Everything else is one step away under "More settings" and "More effects…".
 */
export function QuickMotion({
  moment,
  tiles,
  added,
  animationsFull,
  onMoment,
  onTile,
  onSettings,
  onCommit,
  onMoreSettings,
  onMoreEffects,
  onDone,
}: QuickMotionProps) {
  const t = useTranslate();
  const tileButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const checkedAt = tiles.findIndex((tile) => added?.choice.id === tile.choice.id);

  function moveBetweenTiles(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = { ArrowLeft: -1, ArrowUp: -3, ArrowRight: 1, ArrowDown: 3 }[event.key];
    const target =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tiles.length - 1
          : step === undefined
            ? undefined
            : Math.min(Math.max(index + step, 0), tiles.length - 1);
    const tile = target === undefined ? undefined : tiles[target];
    if (!tile || target === undefined) return;
    event.preventDefault();
    onTile(tile);
    tileButtons.current[target]?.focus();
  }

  return (
    <>
      <style>{motionDemoCss}</style>
      <MomentPicker value={moment} onChange={onMoment} />
      {animationsFull && !added && (
        <p className="px-2.5 text-caption text-warning">{t("motionEditor.panel.animationsFull")}</p>
      )}
      {moment ? (
        <p className="px-2.5 text-caption text-label-secondary">
          {t(`motionEditor.momentNote.${moment}` as MotionEditorStringKey)}
        </p>
      ) : (
        <p className="px-2.5 text-caption text-label-secondary">
          {t("motionEditor.panel.pickMoment")}
        </p>
      )}

      {moment && tiles.length > 0 && (
        <div
          role="radiogroup"
          aria-label={t("motionEditor.panel.styles")}
          className="grid grid-cols-3 gap-1.5"
        >
          {tiles.map((tile, index) => (
            <MotionTile
              key={tile.choice.id}
              buttonRef={(element) => {
                tileButtons.current[index] = element;
              }}
              demo={tile.pick.demo}
              name={t(`motionEditor.quick.${tile.pick.id}` as MotionEditorStringKey)}
              description={tile.choice.description}
              checked={index === checkedAt}
              disabled={animationsFull && !added}
              focusable={checkedAt === -1 ? index === 0 : index === checkedAt}
              onChoose={() => onTile(tile)}
              onKeyDown={(event) => moveBetweenTiles(event, index)}
            />
          ))}
        </div>
      )}

      {added && moment && (
        <QuickControls added={added} moment={moment} onSettings={onSettings} onCommit={onCommit} />
      )}

      <div className="overflow-hidden rounded-card bg-background">
        {added && (
          <LinkRow icon={<SlidersHorizontal className="size-4" />} onClick={onMoreSettings}>
            {t("motionEditor.panel.moreSettings")}
          </LinkRow>
        )}
        <LinkRow icon={<LayoutGrid className="size-4" />} onClick={onMoreEffects}>
          {t("motionEditor.panel.moreEffects")}
        </LinkRow>
      </div>

      {added && (
        <button
          type="button"
          onClick={onDone}
          className="h-10 rounded-card bg-accent-fill font-semibold text-on-accent hover:bg-accent-fill-hover focus-visible:focus-ring"
        >
          {t("motionEditor.panel.done")}
        </button>
      )}
    </>
  );
}

function QuickControls({
  added,
  moment,
  onSettings,
  onCommit,
}: {
  added: QuickAdded;
  moment: MotionMoment;
  onSettings: (settings: QuickSettings, preview: boolean) => void;
  onCommit: () => void;
}) {
  const t = useTranslate();
  const { settings } = added;
  const shows = quickControls(added.base, moment);
  const adjust = (patch: Partial<QuickSettings["adjustments"]>) =>
    onSettings({ ...settings, adjustments: { ...settings.adjustments, ...patch } }, false);
  const commit = () => {
    onSettings(settings, true);
    onCommit();
  };
  if (!shows.howMuch && !shows.speed && !shows.feel && !shows.starts) return null;
  return (
    <div className="flex flex-col gap-3 rounded-card bg-background p-3">
      {shows.howMuch && shows.growsFrom !== undefined && (
        <GrowSizeSlider
          from={shows.growsFrom}
          distance={settings.adjustments.distance}
          onChange={(distance) => adjust({ distance })}
          onCommit={commit}
        />
      )}
      {shows.howMuch && shows.growsFrom === undefined && (
        <Slider
          label={t("motionEditor.panel.howMuch")}
          min={0.25}
          max={2}
          step={0.05}
          value={settings.adjustments.distance}
          minLabel={t("motionEditor.simple.subtle")}
          maxLabel={t("motionEditor.simple.dramatic")}
          valueText={`${Math.round(settings.adjustments.distance * 100)}%`}
          onChange={(distance) => adjust({ distance })}
          onCommit={commit}
        />
      )}
      {shows.speed && (
        <Slider
          label={t("motionEditor.panel.speed")}
          min={0.5}
          max={2}
          step={0.05}
          value={settings.adjustments.speed}
          minLabel={t("motionEditor.simple.slower")}
          maxLabel={t("motionEditor.simple.faster")}
          valueText={t("motionEditor.simple.speedText", {
            speed: formatNumber(settings.adjustments.speed),
          })}
          onChange={(speed) => adjust({ speed })}
          onCommit={commit}
        />
      )}
      {shows.starts && (
        <Slider
          label={t("motionEditor.panel.starts")}
          min={0}
          max={2000}
          step={100}
          value={settings.adjustments.delay}
          minLabel={t("motionEditor.simple.straightAway")}
          maxLabel={t("motionEditor.simple.twoSeconds")}
          displayValue={
            settings.adjustments.delay === 0
              ? t("motionEditor.simple.straightAway")
              : t("motionEditor.simple.seconds", {
                  seconds: formatNumber(settings.adjustments.delay / 1000),
                })
          }
          onChange={(delay) => adjust({ delay })}
          onCommit={commit}
        />
      )}
      {shows.feel && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-footnote font-medium text-label">
            {t("motionEditor.panel.feel")}
          </span>
          <SegmentedControl<MotionFeel>
            label={t("motionEditor.panel.feel")}
            value={settings.feel}
            onChange={(feel) => {
              onSettings({ ...settings, feel }, true);
              onCommit();
            }}
            options={[
              { value: "smooth", label: t("motionEditor.panel.feelSmooth") },
              { value: "springy", label: t("motionEditor.panel.feelSpringy") },
            ]}
          />
        </div>
      )}
    </div>
  );
}

/**
 * "How much" for growing while scrolling: from subtle (it starts at 90% of its size) to
 * dramatic (it starts at a tenth), with the size it starts at shown beside it.
 */
function GrowSizeSlider({
  from,
  distance,
  onChange,
  onCommit,
}: {
  from: number;
  distance: number;
  onChange: (distance: number) => void;
  onCommit: () => void;
}) {
  const t = useTranslate();
  const size = startSizeFor(from, distance);
  const startsAt = t("motionEditor.panel.startsAtSize", { percent: Math.round(size * 100) });
  return (
    <Slider
      label={t("motionEditor.panel.howMuch")}
      min={1 - growRange.largest}
      max={1 - growRange.smallest}
      step={0.05}
      value={Math.round((1 - size) * 100) / 100}
      minLabel={t("motionEditor.simple.subtle")}
      maxLabel={t("motionEditor.simple.dramatic")}
      displayValue={startsAt}
      valueText={startsAt}
      onChange={(grows) => onChange(distanceForStartSize(from, 1 - grows))}
      onCommit={onCommit}
    />
  );
}

function LinkRow({
  icon,
  onClick,
  children,
}: {
  icon: ReactNode;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-2.5 px-2.5 text-start text-body font-medium text-label hover:bg-fill focus-visible:focus-ring [&+button]:hairline-top"
    >
      <span
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-fill-strong"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-label-tertiary" />
    </button>
  );
}
