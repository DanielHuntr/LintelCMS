import type { MotionSpec } from "@lintel/motion";
import { motionPresets, type MotionPreset, type PreviewSample } from "@lintel/motion/presets";
import { motionSpecSchema } from "@lintel/motion/schema";
import { Redo2, Undo2, Waves } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "../controls/Button.js";
import type { OpenGroups } from "../controls/CollapsibleGroup.js";
import { SegmentedControl } from "../controls/SegmentedControl.js";
import { PresetGallery } from "../gallery/PresetGallery.js";
import { useHistory } from "../history/useHistory.js";
import { SimplePanel } from "../simple/SimplePanel.js";
import { TranslateProvider, useTranslate, type Translate } from "../strings/translate.js";
import { TimelineEditor } from "../timeline/TimelineEditor.js";
import { StudioPreview } from "./StudioPreview.js";
import { stateFromSpec, withEditedSpec, type StudioState } from "./studioState.js";

export type StudioView = "gallery" | "simple" | "advanced";

const allViews: readonly StudioView[] = ["gallery", "simple", "advanced"];

export interface MotionStudioProps {
  /** The animation to start from, or null for none yet. Read once, when the studio opens. */
  initialSpec: MotionSpec | null;
  /** The preset the animation came from, if any, so Simple can name it. */
  initialPresetId?: string;
  /** Called with every valid change (and undo or redo). */
  onChange: (spec: MotionSpec, presetId: string | undefined) => void;
  /** The host app's translations; English when left out. */
  translate?: Translate;
  presets?: readonly MotionPreset[];
  /** The stand-in element the large preview animates. Defaults to the preset's own. */
  previewSample?: PreviewSample;
  initialView?: StudioView;
  /**
   * The views on offer, for hosts that keep things simple for beginners (the page builder
   * leaves out "advanced" until someone asks for the timeline). All three by default.
   */
  views?: readonly StudioView[];
  /**
   * Which of Simple's groups (trigger, timing, reducedMotion) are open, for hosts that
   * remember it between visits. Left out, When and Timing start open.
   */
  openGroups?: OpenGroups;
}

/**
 * The animation studio: pick a preset, adjust it with a few friendly sliders, or open the
 * timeline for full control. Undo and redo cover every change (Cmd or Ctrl + Z, and
 * Shift + Cmd + Z or Ctrl + Y).
 */
export function MotionStudio(props: MotionStudioProps) {
  return (
    <TranslateProvider translate={props.translate}>
      <Studio {...props} />
    </TranslateProvider>
  );
}

function isTyping(target: EventTarget) {
  return (
    (target instanceof HTMLInputElement && target.type !== "range" && target.type !== "checkbox") ||
    target instanceof HTMLTextAreaElement
  );
}

function Studio({
  initialSpec,
  initialPresetId,
  onChange,
  presets = motionPresets,
  previewSample,
  initialView,
  views: allowedViews = allViews,
  openGroups,
}: MotionStudioProps) {
  const t = useTranslate();
  const [chosenView, setView] = useState<StudioView>(
    initialView ?? (initialSpec ? "simple" : "gallery"),
  );
  const view = allowedViews.includes(chosenView) ? chosenView : "simple";
  const history = useHistory<StudioState | null>(
    initialSpec ? stateFromSpec(initialSpec, initialPresetId) : null,
  );
  const state = history.value;
  const replay = useRef<() => void>(() => undefined);
  const seek = useRef<(milliseconds: number) => void>(() => undefined);
  const seekPreview = useCallback((milliseconds: number) => seek.current(milliseconds), []);
  const preset = useMemo(
    () => presets.find((candidate) => candidate.id === state?.presetId),
    [presets, state?.presetId],
  );
  const problem = useMemo(() => {
    if (!state) return undefined;
    const result = motionSpecSchema.safeParse(state.spec);
    return result.success ? undefined : result.error.issues[0]?.message;
  }, [state]);

  const reported = useRef(state?.spec);
  useEffect(() => {
    if (!state || problem || reported.current === state.spec) return;
    reported.current = state.spec;
    onChange(state.spec, state.presetId);
  }, [state, problem, onChange]);

  function choosePreset(chosen: MotionPreset) {
    history.change(stateFromSpec(chosen.spec, chosen.id));
    history.checkpoint();
    setView("simple");
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (isTyping(event.target)) return;
    const command = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (command && key === "z") {
      event.preventDefault();
      if (event.shiftKey) history.redo();
      else history.undo();
    } else if (command && key === "y") {
      event.preventDefault();
      history.redo();
    }
  }

  const views = (
    [
      { value: "gallery", label: t("motionEditor.view.gallery") },
      { value: "simple", label: t("motionEditor.view.simple") },
      { value: "advanced", label: t("motionEditor.view.advanced") },
    ] as const
  ).filter((option) => allowedViews.includes(option.value));

  return (
    <div className="flex flex-col gap-5 text-label" onKeyDown={handleKeyDown}>
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label={t("motionEditor.view.label")}
          options={views}
          value={view}
          onChange={setView}
        />
        <div className="ms-auto flex gap-1">
          <Button
            variant="plain"
            icon={<Undo2 aria-hidden="true" />}
            label={t("motionEditor.undo")}
            disabled={!history.canUndo}
            onClick={history.undo}
          />
          <Button
            variant="plain"
            icon={<Redo2 aria-hidden="true" />}
            label={t("motionEditor.redo")}
            disabled={!history.canRedo}
            onClick={history.redo}
          />
        </div>
      </div>

      {view === "gallery" && (
        <PresetGallery presets={presets} selectedId={state?.presetId} onSelect={choosePreset} />
      )}

      {view !== "gallery" && !state && (
        <div className="flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-12 text-center hairline-ring">
          <Waves aria-hidden="true" className="size-8 text-accent" />
          <h3 className="text-headline">{t("motionEditor.empty.title")}</h3>
          <p className="max-w-sm text-footnote text-label-secondary">
            {t("motionEditor.empty.description")}
          </p>
          <Button variant="filled" onClick={() => setView("gallery")}>
            {t("motionEditor.empty.action")}
          </Button>
        </div>
      )}

      {view !== "gallery" && state && (
        <>
          <StudioPreview
            spec={state.spec}
            sample={previewSample ?? preset?.preview.sample ?? "card"}
            replayRef={replay}
            seekRef={seek}
          />
          {problem && (
            <p
              role="status"
              className="rounded-control bg-warning/12 px-3 py-2 text-footnote text-warning"
            >
              {t("motionEditor.problem", { problem })}
            </p>
          )}
          {view === "simple" ? (
            <SimplePanel
              state={state}
              preset={preset}
              onChange={history.change}
              onCommit={history.checkpoint}
              onReplay={() => replay.current()}
              onBrowse={() => setView("gallery")}
              openGroups={openGroups}
            />
          ) : (
            <TimelineEditor
              spec={state.spec}
              onChange={(spec, mergeKey) => history.change(withEditedSpec(state, spec), mergeKey)}
              onCommit={history.checkpoint}
              onSeek={seekPreview}
            />
          )}
        </>
      )}
    </div>
  );
}
