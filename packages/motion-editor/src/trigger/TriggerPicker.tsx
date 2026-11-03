import type { LeaveBehaviour } from "@lintel/motion/schema";
import type { MotionSpec, Trigger, TriggerType } from "@lintel/motion";
import { Checkbox, Select, TextInput } from "../controls/Field.js";
import { SegmentedControl } from "../controls/SegmentedControl.js";
import { Slider } from "../controls/Slider.js";
import type { MotionEditorStringKey } from "../strings/motionEditorStrings.js";
import { useTranslate } from "../strings/translate.js";
import { changeTriggerType, withTrigger } from "./changeTrigger.js";
import { ScrollSceneEditor } from "./ScrollSceneEditor.js";
import { useSceneElements } from "./sceneElements.js";

/** What starts the animation, in plain words, with the few options each trigger has. */

export const triggerLabels: Record<TriggerType, MotionEditorStringKey> = {
  inView: "motionEditor.trigger.inView",
  load: "motionEditor.trigger.load",
  scroll: "motionEditor.trigger.scroll",
  hover: "motionEditor.trigger.hover",
  click: "motionEditor.trigger.click",
  focus: "motionEditor.trigger.focus",
  pointer: "motionEditor.trigger.pointer",
  event: "motionEditor.trigger.event",
  pageExit: "motionEditor.trigger.pageExit",
};

const triggerHints: Record<TriggerType, MotionEditorStringKey> = {
  inView: "motionEditor.trigger.inViewHint",
  load: "motionEditor.trigger.loadHint",
  scroll: "motionEditor.trigger.scrollHint",
  hover: "motionEditor.trigger.hoverHint",
  click: "motionEditor.trigger.clickHint",
  focus: "motionEditor.trigger.focusHint",
  pointer: "motionEditor.trigger.pointerHint",
  event: "motionEditor.trigger.eventHint",
  pageExit: "motionEditor.trigger.pageExitHint",
};

interface TriggerPickerProps {
  spec: MotionSpec;
  onChange: (spec: MotionSpec, mergeKey?: string) => void;
  onCommit: () => void;
  /** The Simple panel shows only the choice; the timeline shows every option. */
  showOptions?: boolean;
}

function LeaveSelect({
  value,
  onChange,
}: {
  value: LeaveBehaviour;
  onChange: (value: LeaveBehaviour) => void;
}) {
  const t = useTranslate();
  return (
    <Select
      label={t("motionEditor.trigger.onLeave")}
      value={value}
      onChange={(event) => onChange(event.target.value as LeaveBehaviour)}
      options={[
        { value: "reverse", label: t("motionEditor.trigger.leaveReverse") },
        { value: "stay", label: t("motionEditor.trigger.leaveStay") },
        { value: "reset", label: t("motionEditor.trigger.leaveReset") },
      ]}
    />
  );
}

const snapChoices: Record<string, number[] | undefined> = {
  none: undefined,
  halves: [0, 0.5, 1],
  thirds: [0, 1 / 3, 2 / 3, 1],
  quarters: [0, 0.25, 0.5, 0.75, 1],
};

function snapChoiceOf(points: readonly number[] | undefined): string {
  if (!points) return "none";
  return (
    Object.entries(snapChoices).find(
      ([, choice]) => choice && choice.length === points.length,
    )?.[0] ?? "none"
  );
}

type BackUp = "stay" | "reverse" | "replay";

/** "Scrolling back up past it", as the in-view trigger's actions per direction. */
function backUpOf(trigger: Extract<Trigger, { type: "inView" }>): BackUp {
  const actions = trigger.actions;
  if (!actions) return "stay";
  if (actions.leaveBack === "reverse") return "reverse";
  if (actions.leaveBack === "reset") return "replay";
  return "stay";
}

function withBackUp(
  trigger: Extract<Trigger, { type: "inView" }>,
  backUp: BackUp,
): Extract<Trigger, { type: "inView" }> {
  const rest = { ...trigger };
  delete rest.actions;
  if (backUp === "stay") return rest;
  return {
    ...rest,
    actions:
      backUp === "reverse"
        ? { enter: "play", leave: "none", enterBack: "none", leaveBack: "reverse" }
        : { enter: "restart", leave: "none", enterBack: "none", leaveBack: "reset" },
  };
}

function TriggerOptions({ spec, onChange, onCommit }: TriggerPickerProps) {
  const t = useTranslate();
  const sceneElements = useSceneElements();
  const { trigger } = spec;
  const set = (next: Trigger, mergeKey?: string) => onChange(withTrigger(spec, next), mergeKey);
  switch (trigger.type) {
    case "inView":
      return (
        <div className="grid gap-4 @md:grid-cols-2">
          <Slider
            label={t("motionEditor.trigger.threshold")}
            min={0}
            max={1}
            step={0.05}
            value={trigger.threshold}
            displayValue={`${Math.round(trigger.threshold * 100)}%`}
            minLabel={t("motionEditor.trigger.thresholdAny")}
            maxLabel={t("motionEditor.trigger.thresholdAll")}
            onChange={(threshold) => set({ ...trigger, threshold }, "threshold")}
            onCommit={onCommit}
          />
          {!trigger.actions && (
            <LeaveSelect
              value={trigger.onLeave}
              onChange={(onLeave) => set({ ...trigger, onLeave })}
            />
          )}
          <Select
            label={t("motionEditor.trigger.backUp")}
            value={backUpOf(trigger)}
            onChange={(event) => set(withBackUp(trigger, event.target.value as BackUp))}
            options={[
              { value: "stay", label: t("motionEditor.trigger.backUpStay") },
              { value: "reverse", label: t("motionEditor.trigger.backUpReverse") },
              { value: "replay", label: t("motionEditor.trigger.backUpReplay") },
            ]}
          />
        </div>
      );
    case "scroll":
      return (
        <div className="flex flex-col gap-4">
          <SegmentedControl
            label={t("motionEditor.trigger.scrollScope")}
            value={trigger.scope}
            onChange={(scope) => set({ ...trigger, scope })}
            options={[
              { value: "element", label: t("motionEditor.trigger.scopeElement") },
              { value: "page", label: t("motionEditor.trigger.scopePage") },
            ]}
          />
          {trigger.scope === "element" && (
            <>
              <Checkbox
                label={t("motionEditor.trigger.pin")}
                checked={trigger.pin !== undefined}
                onChange={(pinned) => {
                  const unpinned = { ...trigger };
                  delete unpinned.pin;
                  set(pinned ? { ...trigger, pin: { length: 1 } } : unpinned);
                }}
              />
              {trigger.pin && (
                <Slider
                  label={t("motionEditor.trigger.pinLength")}
                  min={0.25}
                  max={10}
                  step={0.25}
                  value={trigger.pin.length}
                  displayValue={t("motionEditor.trigger.screens", { count: trigger.pin.length })}
                  onChange={(length) => set({ ...trigger, pin: { length } }, "pin")}
                  onCommit={onCommit}
                />
              )}
              <ScrollSceneEditor
                trigger={trigger}
                onChange={(next, mergeKey) => set(next, mergeKey)}
                onCommit={onCommit}
              />
            </>
          )}
          {sceneElements.length > 0 && trigger.scope === "element" && (
            <Select
              label={t("motionEditor.trigger.follows")}
              hint={t("motionEditor.trigger.followsHint")}
              value={trigger.follows ?? ""}
              onChange={(event) => {
                const rest = { ...trigger };
                delete rest.follows;
                delete rest.range;
                const follows = event.target.value;
                set(follows ? { ...rest, follows, range: { from: 0, to: 1 } } : rest);
              }}
              options={[
                { value: "", label: t("motionEditor.trigger.followsSelf") },
                ...sceneElements.map((element) => ({ value: element.id, label: element.name })),
              ]}
            />
          )}
          {trigger.follows && trigger.range && (
            <div className="grid gap-4 @md:grid-cols-2">
              <Slider
                label={t("motionEditor.trigger.rangeFrom")}
                min={0}
                max={0.95}
                step={0.05}
                value={trigger.range.from}
                displayValue={t("motionEditor.trigger.rangeValue", {
                  percent: Math.round(trigger.range.from * 100),
                })}
                onChange={(from) =>
                  set(
                    { ...trigger, range: { from, to: Math.max(trigger.range!.to, from + 0.05) } },
                    "range",
                  )
                }
                onCommit={onCommit}
              />
              <Slider
                label={t("motionEditor.trigger.rangeTo")}
                min={0.05}
                max={1}
                step={0.05}
                value={trigger.range.to}
                displayValue={t("motionEditor.trigger.rangeValue", {
                  percent: Math.round(trigger.range.to * 100),
                })}
                onChange={(to) =>
                  set(
                    { ...trigger, range: { from: Math.min(trigger.range!.from, to - 0.05), to } },
                    "range",
                  )
                }
                onCommit={onCommit}
              />
            </div>
          )}
          <Slider
            label={t("motionEditor.trigger.smooth")}
            min={0}
            max={2}
            step={0.1}
            value={trigger.smooth}
            displayValue={
              trigger.smooth === 0
                ? t("motionEditor.trigger.smoothExact")
                : t("motionEditor.trigger.smoothValue", { seconds: trigger.smooth.toFixed(1) })
            }
            minLabel={t("motionEditor.trigger.smoothExact")}
            maxLabel={t("motionEditor.trigger.smoothSoft")}
            onChange={(smooth) => set({ ...trigger, smooth }, "smooth")}
            onCommit={onCommit}
          />
          <Select
            label={t("motionEditor.trigger.snap")}
            value={snapChoiceOf(trigger.snap)}
            onChange={(event) => {
              const points = snapChoices[event.target.value];
              const rest = { ...trigger };
              delete rest.snap;
              set(points ? { ...rest, snap: points } : rest);
            }}
            options={[
              { value: "none", label: t("motionEditor.trigger.snapNone") },
              { value: "halves", label: t("motionEditor.trigger.snapHalves") },
              { value: "thirds", label: t("motionEditor.trigger.snapThirds") },
              { value: "quarters", label: t("motionEditor.trigger.snapQuarters") },
            ]}
          />
        </div>
      );
    case "hover":
    case "focus":
      return (
        <LeaveSelect value={trigger.onLeave} onChange={(onLeave) => set({ ...trigger, onLeave })} />
      );
    case "click":
      return (
        <Checkbox
          label={t("motionEditor.trigger.toggle")}
          checked={trigger.toggle}
          onChange={(toggle) => set({ ...trigger, toggle })}
        />
      );
    case "pointer":
      return (
        <Slider
          label={t("motionEditor.trigger.smoothing")}
          min={0}
          max={0.95}
          step={0.05}
          value={trigger.smoothing}
          minLabel={t("motionEditor.trigger.smoothingTight")}
          maxLabel={t("motionEditor.trigger.smoothingSoft")}
          onChange={(smoothing) => set({ ...trigger, smoothing }, "smoothing")}
          onCommit={onCommit}
        />
      );
    case "event":
      return (
        <div className="grid gap-4 @md:grid-cols-2">
          <TextInput
            label={t("motionEditor.trigger.eventName")}
            hint={t("motionEditor.trigger.eventNameHint")}
            value={trigger.name}
            onChange={(event) =>
              set(
                { ...trigger, name: event.target.value.replace(/[^\w:.-]/g, "") || "motion:play" },
                "event-name",
              )
            }
            onBlur={onCommit}
          />
          <Select
            label={t("motionEditor.trigger.listenOn")}
            value={trigger.listenOn}
            onChange={(event) =>
              set({ ...trigger, listenOn: event.target.value as "self" | "document" })
            }
            options={[
              { value: "document", label: t("motionEditor.trigger.listenDocument") },
              { value: "self", label: t("motionEditor.trigger.listenSelf") },
            ]}
          />
        </div>
      );
    case "load":
    case "pageExit":
      return null;
  }
}

export function TriggerPicker({
  spec,
  onChange,
  onCommit,
  showOptions = true,
}: TriggerPickerProps) {
  const t = useTranslate();
  const types = Object.keys(triggerLabels) as TriggerType[];
  // Its options sit side by side only where there's room: in the builder's side panel they
  // stack, one to a row, whatever the size of the window.
  return (
    <div className="@container flex flex-col gap-4">
      <Select
        label={t("motionEditor.trigger.label")}
        hint={t(triggerHints[spec.trigger.type])}
        value={spec.trigger.type}
        onChange={(event) => onChange(changeTriggerType(spec, event.target.value as TriggerType))}
        options={types.map((type) => ({ value: type, label: t(triggerLabels[type]) }))}
      />
      {showOptions && <TriggerOptions spec={spec} onChange={onChange} onCommit={onCommit} />}
    </div>
  );
}
