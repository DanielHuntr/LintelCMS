import type { LeaveBehaviour } from "@lintel/motion/schema";
import type { MotionSpec, Trigger, TriggerType } from "@lintel/motion";
import { Checkbox, Select, TextInput } from "../controls/Field.js";
import { SegmentedControl } from "../controls/SegmentedControl.js";
import { Slider } from "../controls/Slider.js";
import type { MotionEditorStringKey } from "../strings/motionEditorStrings.js";
import { useTranslate } from "../strings/translate.js";
import { changeTriggerType, withTrigger } from "./changeTrigger.js";
import { ScrollSceneEditor } from "./ScrollSceneEditor.js";

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

function TriggerOptions({ spec, onChange, onCommit }: TriggerPickerProps) {
  const t = useTranslate();
  const { trigger } = spec;
  const set = (next: Trigger, mergeKey?: string) => onChange(withTrigger(spec, next), mergeKey);
  switch (trigger.type) {
    case "inView":
      return (
        <div className="grid grid-cols-2 gap-4">
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
          <LeaveSelect
            value={trigger.onLeave}
            onChange={(onLeave) => set({ ...trigger, onLeave })}
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
        <div className="grid grid-cols-2 gap-4">
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
  return (
    <div className="flex flex-col gap-4">
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
