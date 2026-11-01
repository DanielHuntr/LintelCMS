import type { MotionPreset } from "@lintel/motion/presets";
import { LayoutGrid, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "../controls/Button.js";
import { CollapsibleGroup, type OpenGroups } from "../controls/CollapsibleGroup.js";
import { Slider } from "../controls/Slider.js";
import { useTranslate } from "../strings/translate.js";
import { withAdjustments, withBaseChange, type StudioState } from "../studio/studioState.js";
import { ReducedMotionSelect } from "../timeline/AnimationSettings.js";
import { triggerLabels, TriggerPicker } from "../trigger/TriggerPicker.js";
import { hasDistance, hasManyTargets, type SimpleAdjustments } from "./adjustSpec.js";

interface SimplePanelProps {
  state: StudioState;
  preset: MotionPreset | undefined;
  onChange: (state: StudioState, mergeKey?: string) => void;
  onCommit: () => void;
  onReplay: () => void;
  onBrowse: () => void;
  /** Which groups are open; the host can remember it. When and timing are open at first. */
  openGroups?: OpenGroups;
}

const openAtFirst = ["trigger", "timing"];

function useOpenGroups(fromHost: OpenGroups | undefined): OpenGroups {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(openAtFirst));
  return (
    fromHost ?? {
      isOpen: (groupId) => open.has(groupId),
      toggle: (groupId) =>
        setOpen((current) => {
          const next = new Set(current);
          if (next.has(groupId)) next.delete(groupId);
          else next.add(groupId);
          return next;
        }),
    }
  );
}

/** The friendly controls: what starts it, then a few sliders in words rather than numbers. */
export function SimplePanel({
  state,
  preset,
  onChange,
  onCommit,
  onReplay,
  onBrowse,
  openGroups: openGroupsFromHost,
}: SimplePanelProps) {
  const t = useTranslate();
  const openGroups = useOpenGroups(openGroupsFromHost);
  const { adjustments, spec } = state;
  const speed = t("motionEditor.simple.speedValue", {
    speed: adjustments.speed.toFixed(2).replace(/\.?0+$/, ""),
  });
  const delay = t("motionEditor.simple.seconds", {
    seconds: (adjustments.delay / 1000).toFixed(2).replace(/\.?0+$/, "") || "0",
  });
  const group = (groupId: string) => ({
    isOpen: openGroups.isOpen(groupId),
    onToggle: () => openGroups.toggle(groupId),
  });
  const adjust = (patch: Partial<SimpleAdjustments>, mergeKey: string) =>
    onChange(withAdjustments(state, { ...adjustments, ...patch }), mergeKey);

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
        <div className="min-w-0">
          <h3 className="text-headline text-label">
            {preset?.name ?? t("motionEditor.simple.custom")}
          </h3>
          <p className="text-footnote text-label-secondary">
            {preset?.description ?? t("motionEditor.simple.customDescription")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button icon={<LayoutGrid aria-hidden="true" />} onClick={onBrowse}>
            {t("motionEditor.simple.browse")}
          </Button>
          <Button variant="filled" icon={<RotateCcw aria-hidden="true" />} onClick={onReplay}>
            {t("motionEditor.simple.replay")}
          </Button>
        </div>
      </div>

      <CollapsibleGroup
        title={t("motionEditor.simple.groupTrigger")}
        summary={t(triggerLabels[spec.trigger.type])}
        {...group("trigger")}
      >
        <TriggerPicker
          spec={spec}
          showOptions={false}
          onChange={(next) =>
            onChange(
              withBaseChange(state, (base) => ({
                ...next,
                duration: base.duration,
                delay: base.delay,
                stagger: base.stagger,
                tracks: next.trigger.type === "pointer" ? next.tracks : base.tracks,
              })),
            )
          }
          onCommit={onCommit}
        />
      </CollapsibleGroup>

      <CollapsibleGroup
        title={t("motionEditor.simple.groupTiming")}
        summary={t("motionEditor.simple.timingSummary", { speed, seconds: delay })}
        {...group("timing")}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Slider
            label={t("motionEditor.simple.speed")}
            min={0.25}
            max={3}
            step={0.05}
            value={adjustments.speed}
            minLabel={t("motionEditor.simple.slower")}
            maxLabel={t("motionEditor.simple.faster")}
            displayValue={speed}
            valueText={t("motionEditor.simple.speedText", {
              speed: adjustments.speed.toFixed(2).replace(/\.?0+$/, ""),
            })}
            onChange={(speed) => adjust({ speed }, "speed")}
            onCommit={onCommit}
          />
          {hasDistance(state.base) && (
            <Slider
              label={t("motionEditor.simple.distance")}
              min={0}
              max={2}
              step={0.05}
              value={adjustments.distance}
              minLabel={t("motionEditor.simple.subtle")}
              maxLabel={t("motionEditor.simple.dramatic")}
              displayValue={`${Math.round(adjustments.distance * 100)}%`}
              onChange={(distance) => adjust({ distance }, "distance")}
              onCommit={onCommit}
            />
          )}
          <Slider
            label={t("motionEditor.simple.delay")}
            min={0}
            max={2000}
            step={50}
            value={adjustments.delay}
            minLabel={t("motionEditor.simple.straightAway")}
            maxLabel={t("motionEditor.simple.twoSeconds")}
            displayValue={delay}
            onChange={(delay) => adjust({ delay }, "delay")}
            onCommit={onCommit}
          />
          {hasManyTargets(state.base) && (
            <Slider
              label={t("motionEditor.simple.stagger")}
              min={0}
              max={300}
              step={5}
              value={adjustments.stagger}
              minLabel={t("motionEditor.simple.together")}
              maxLabel={t("motionEditor.simple.oneByOne")}
              displayValue={t("motionEditor.simple.milliseconds", {
                milliseconds: adjustments.stagger,
              })}
              onChange={(stagger) => adjust({ stagger }, "stagger")}
              onCommit={onCommit}
            />
          )}
        </div>
      </CollapsibleGroup>

      <CollapsibleGroup
        title={t("motionEditor.simple.groupReduced")}
        summary={t(`motionEditor.reduced.${spec.reducedMotion}`)}
        {...group("reducedMotion")}
      >
        <ReducedMotionSelect
          value={spec.reducedMotion}
          onChange={(reducedMotion) =>
            onChange(withBaseChange(state, (base) => ({ ...base, reducedMotion })))
          }
        />
      </CollapsibleGroup>
    </div>
  );
}
