import { catalogueProperties, type AnimatableProperty, type MotionSpec } from "@lintel/motion";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type WheelEvent } from "react";
import { Button } from "../controls/Button.js";
import { Select } from "../controls/Field.js";
import { Slider } from "../controls/Slider.js";
import { useTranslate } from "../strings/translate.js";
import { AnimationSettings } from "./AnimationSettings.js";
import { addTrack } from "./editSpec.js";
import { KeyframeInspector } from "./KeyframeInspector.js";
import { propertyLabelKeys } from "./propertyLabels.js";
import { TimeRuler } from "./TimeRuler.js";
import { baseTimelineWidth, clamp, formatSeconds } from "./timelineMath.js";
import { TrackLabel, TrackLane, type KeyframeSelection } from "./TrackRow.js";

interface TimelineEditorProps {
  spec: MotionSpec;
  onChange: (spec: MotionSpec, mergeKey?: string) => void;
  onCommit: () => void;
  /** Shows the preview at this moment, in ms from the start of the first target. */
  onSeek: (milliseconds: number) => void;
}

const newVariable = "--custom";

/**
 * The advanced editor: a track per property with draggable keyframes, a zoomable ruler and
 * a playhead that scrubs the preview. Space plays and pauses while the timeline has focus.
 */
export function TimelineEditor({ spec, onChange, onCommit, onSeek }: TimelineEditorProps) {
  const t = useTranslate();
  // Starting at the end shows the element as it settles, rather than an empty first frame.
  const [playhead, setPlayhead] = useState(spec.duration);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selection, setSelection] = useState<KeyframeSelection | undefined>(undefined);
  const frame = useRef(0);
  const duration = Math.max(spec.duration, 1);
  const pixelsPerMillisecond = (baseTimelineWidth * zoom) / duration;
  const shownPlayhead = Math.min(playhead, duration);

  useEffect(() => onSeek(shownPlayhead), [onSeek, shownPlayhead, spec]);

  // The clock lives in a ref so each frame reads the latest time without waiting for a render.
  const clock = useRef(spec.duration);
  const movePlayhead = (milliseconds: number) => {
    clock.current = milliseconds;
    setPlayhead(milliseconds);
  };

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const step = (now: number) => {
      const next = clock.current + (now - last);
      last = now;
      if (next >= duration && spec.repeat.times !== "forever") {
        movePlayhead(duration);
        setPlaying(false);
        return;
      }
      clock.current = next >= duration ? 0 : next;
      setPlayhead(clock.current);
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [playing, duration, spec.repeat.times]);

  function togglePlaying() {
    if (!playing && playhead >= duration) movePlayhead(0);
    setPlaying(!playing);
  }

  function zoomWithWheel(event: WheelEvent) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setZoom((current) => clamp(current * (event.deltaY < 0 ? 1.15 : 1 / 1.15), 0.5, 6));
  }

  const unused = catalogueProperties.filter(
    (property) => !spec.tracks.some((track) => track.property === property),
  );
  const trackProps = {
    spec,
    pixelsPerMillisecond,
    playhead: shownPlayhead,
    selection,
    onSelect: setSelection,
    onChange,
    onCommit,
  };
  const validSelection =
    selection && spec.tracks[selection.trackIndex]?.keyframes[selection.keyframeIndex]
      ? selection
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label={t("motionEditor.timeline.title")}
        className="flex flex-col gap-3 rounded-card bg-surface p-4 hairline-ring"
        onKeyDown={(event) => {
          if (
            event.key !== " " ||
            event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLButtonElement ||
            event.target instanceof HTMLSelectElement
          )
            return;
          event.preventDefault();
          togglePlaying();
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="filled"
            icon={playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            onClick={togglePlaying}
          >
            {playing ? t("motionEditor.timeline.pause") : t("motionEditor.timeline.play")}
          </Button>
          <span className="text-footnote text-label-secondary tabular-nums" aria-live="off">
            {formatSeconds(shownPlayhead)} / {formatSeconds(spec.duration)}
          </span>
          <div className="ml-auto w-40">
            <Slider
              label={t("motionEditor.timeline.zoom")}
              min={0.5}
              max={6}
              step={0.25}
              value={zoom}
              displayValue={`${Math.round(zoom * 100)}%`}
              onChange={setZoom}
            />
          </div>
          <div className="w-48">
            <Select
              label={t("motionEditor.timeline.addTrack")}
              value=""
              onChange={(event) => {
                const property = event.target.value as AnimatableProperty;
                if (property) onChange(addTrack(spec, property));
              }}
              options={[
                { value: "", label: t("motionEditor.timeline.chooseProperty") },
                ...unused.map((property) => ({
                  value: property,
                  label: t(propertyLabelKeys[property]),
                })),
                ...(spec.tracks.some((track) => track.property === newVariable)
                  ? []
                  : [{ value: newVariable, label: t("motionEditor.timeline.cssVariable") }]),
              ]}
            />
          </div>
        </div>
        <div className="flex">
          <div className="w-44 shrink-0">
            <div className="h-7 hairline-bottom" />
            {spec.tracks.map((track, trackIndex) => (
              <TrackLabel
                key={track.property}
                track={track}
                trackIndex={trackIndex}
                {...trackProps}
              />
            ))}
          </div>
          <div
            className="relative min-w-0 flex-1 overflow-x-auto pr-4 pb-2 pl-2"
            onWheel={zoomWithWheel}
          >
            <TimeRuler
              duration={duration}
              pixelsPerMillisecond={pixelsPerMillisecond}
              playhead={shownPlayhead}
              onSeek={movePlayhead}
            />
            {spec.tracks.map((track, trackIndex) => (
              <TrackLane
                key={track.property}
                track={track}
                trackIndex={trackIndex}
                {...trackProps}
              />
            ))}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-7 bottom-2 w-px bg-accent-fill"
              style={{ left: 8 + shownPlayhead * pixelsPerMillisecond }}
            />
          </div>
        </div>
        <p className="text-caption text-label-tertiary">{t("motionEditor.timeline.help")}</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-card bg-surface p-4 hairline-ring">
          {validSelection ? (
            <KeyframeInspector
              spec={spec}
              selection={validSelection}
              onSelect={setSelection}
              onChange={onChange}
              onCommit={onCommit}
            />
          ) : (
            <p className="text-footnote text-label-secondary">
              {t("motionEditor.inspector.empty")}
            </p>
          )}
        </div>
        <div className="rounded-card bg-surface p-4 hairline-ring">
          <AnimationSettings spec={spec} onChange={onChange} onCommit={onCommit} />
        </div>
      </div>
    </div>
  );
}
