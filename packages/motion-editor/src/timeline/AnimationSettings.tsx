import type { MotionSpec, ReducedMotionBehaviour, Targets } from "@lintel/motion";
import { Checkbox, Select, TextInput } from "../controls/Field.js";
import { EasingEditor } from "../easing-editor/EasingEditor.js";
import { useTranslate } from "../strings/translate.js";
import { TriggerPicker } from "../trigger/TriggerPicker.js";
import { setDuration } from "./editSpec.js";

interface AnimationSettingsProps {
  spec: MotionSpec;
  onChange: (spec: MotionSpec, mergeKey?: string) => void;
  onCommit: () => void;
}

type TargetChoice = "self" | "children" | "words" | "letters" | "selector" | "nodes";

function targetChoiceOf(targets: Targets): TargetChoice {
  return targets.type === "text" ? targets.split : targets.type;
}

function targetsFor(choice: TargetChoice, current: Targets): Targets {
  switch (choice) {
    case "words":
    case "letters":
      return { type: "text", split: choice };
    case "selector":
      return current.type === "selector" ? current : { type: "selector", selector: ".item" };
    case "nodes":
      return current.type === "nodes" ? current : { type: "nodes", nodeIds: [] };
    default:
      return { type: choice };
  }
}

/** Everything about the animation as a whole: what starts it, what moves, timing and repeats. */
export function AnimationSettings({ spec, onChange, onCommit }: AnimationSettingsProps) {
  const t = useTranslate();
  const set = (patch: Partial<MotionSpec>, mergeKey?: string) =>
    onChange({ ...spec, ...patch }, mergeKey);
  const targetChoice = targetChoiceOf(spec.targets);
  const number = (text: string, fallback: number) =>
    Number.isFinite(Number(text)) && text !== "" ? Number(text) : fallback;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="text-headline text-label">{t("motionEditor.settings.trigger")}</h3>
        <TriggerPicker spec={spec} onChange={onChange} onCommit={onCommit} />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-headline text-label">{t("motionEditor.settings.targets")}</h3>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label={t("motionEditor.settings.whatMoves")}
            value={targetChoice}
            onChange={(event) =>
              set({ targets: targetsFor(event.target.value as TargetChoice, spec.targets) })
            }
            options={(["self", "children", "words", "letters", "selector", "nodes"] as const).map(
              (value) => ({ value, label: t(`motionEditor.targets.${value}`) }),
            )}
          />
          {spec.targets.type === "selector" && (
            <TextInput
              label={t("motionEditor.settings.selector")}
              hint={t("motionEditor.settings.selectorHint")}
              value={spec.targets.selector}
              onChange={(event) =>
                set(
                  { targets: { type: "selector", selector: event.target.value || "*" } },
                  "selector",
                )
              }
              onBlur={onCommit}
            />
          )}
          {spec.targets.type === "nodes" && (
            <TextInput
              label={t("motionEditor.settings.nodeIds")}
              hint={t("motionEditor.settings.nodeIdsHint")}
              defaultValue={spec.targets.nodeIds.join(", ")}
              onChange={(event) =>
                set(
                  {
                    targets: {
                      type: "nodes",
                      nodeIds: event.target.value
                        .split(",")
                        .map((id) => id.trim())
                        .filter(Boolean),
                    },
                  },
                  "nodes",
                )
              }
              onBlur={onCommit}
            />
          )}
          {spec.targets.type !== "self" && (
            <>
              <TextInput
                label={t("motionEditor.settings.staggerEach")}
                type="number"
                min={0}
                step={10}
                value={spec.stagger.each}
                onChange={(event) =>
                  set(
                    { stagger: { ...spec.stagger, each: number(event.target.value, 0) } },
                    "stagger",
                  )
                }
                onBlur={onCommit}
              />
              <Select
                label={t("motionEditor.settings.staggerFrom")}
                value={spec.stagger.from}
                onChange={(event) =>
                  set({
                    stagger: {
                      ...spec.stagger,
                      from: event.target.value as MotionSpec["stagger"]["from"],
                    },
                  })
                }
                options={(["first", "last", "center", "edges", "random"] as const).map((value) => ({
                  value,
                  label: t(`motionEditor.stagger.${value}`),
                }))}
              />
            </>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-headline text-label">{t("motionEditor.settings.timing")}</h3>
        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label={t("motionEditor.settings.duration")}
            type="number"
            min={0}
            step={50}
            value={spec.duration}
            onChange={(event) =>
              onChange(setDuration(spec, number(event.target.value, spec.duration)), "duration")
            }
            onBlur={onCommit}
          />
          <TextInput
            label={t("motionEditor.settings.delay")}
            type="number"
            min={0}
            step={50}
            value={spec.delay}
            onChange={(event) =>
              set({ delay: Math.max(0, number(event.target.value, 0)) }, "delay")
            }
            onBlur={onCommit}
          />
          {spec.trigger.type !== "scroll" && (
            <>
              <Select
                label={t("motionEditor.settings.repeat")}
                value={String(spec.repeat.times)}
                onChange={(event) =>
                  set({
                    repeat: {
                      ...spec.repeat,
                      times:
                        event.target.value === "forever" ? "forever" : Number(event.target.value),
                    },
                  })
                }
                options={[
                  { value: "0", label: t("motionEditor.repeat.once") },
                  ...[1, 2, 3, 5].map((times) => ({
                    value: String(times),
                    label: t("motionEditor.repeat.times", { count: times + 1 }),
                  })),
                  { value: "forever", label: t("motionEditor.repeat.forever") },
                ]}
              />
              <div className="flex items-end pb-1.5">
                <Checkbox
                  label={t("motionEditor.settings.yoyo")}
                  checked={spec.repeat.yoyo}
                  onChange={(yoyo) => set({ repeat: { ...spec.repeat, yoyo } })}
                />
              </div>
            </>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-headline text-label">{t("motionEditor.settings.easing")}</h3>
        <EasingEditor
          value={spec.easing}
          onChange={(easing, mergeKey) => set({ easing: easing ?? "easeOut" }, mergeKey)}
          onCommit={onCommit}
          onMatchDuration={(duration) => onChange(setDuration(spec, duration))}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-headline text-label">{t("motionEditor.settings.reducedMotion")}</h3>
        <ReducedMotionSelect
          value={spec.reducedMotion}
          onChange={(reducedMotion) => set({ reducedMotion })}
        />
      </section>
    </div>
  );
}

export function ReducedMotionSelect({
  value,
  onChange,
}: {
  value: ReducedMotionBehaviour;
  onChange: (value: ReducedMotionBehaviour) => void;
}) {
  const t = useTranslate();
  return (
    <Select
      label={t("motionEditor.reduced.label")}
      hint={t(`motionEditor.reduced.${value}Hint`)}
      value={value}
      onChange={(event) => onChange(event.target.value as ReducedMotionBehaviour)}
      options={(["fade", "instant", "none"] as const).map((behaviour) => ({
        value: behaviour,
        label: t(`motionEditor.reduced.${behaviour}`),
      }))}
    />
  );
}
