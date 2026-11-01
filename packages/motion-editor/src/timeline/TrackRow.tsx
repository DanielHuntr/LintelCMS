import type { MotionSpec, Track } from "@lintel/motion";
import { Plus, Trash2 } from "lucide-react";
import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { Button } from "../controls/Button.js";
import { classNames } from "../controls/classNames.js";
import { useTranslate } from "../strings/translate.js";
import { addKeyframe, moveKeyframe, removeKeyframe, removeTrack } from "./editSpec.js";
import { usePropertyLabel } from "./propertyLabels.js";
import { clamp, formatSeconds } from "./timelineMath.js";

export interface KeyframeSelection {
  trackIndex: number;
  keyframeIndex: number;
}

interface TrackRowProps {
  spec: MotionSpec;
  track: Track;
  trackIndex: number;
  pixelsPerMillisecond: number;
  playhead: number;
  selection: KeyframeSelection | undefined;
  onSelect: (selection: KeyframeSelection | undefined) => void;
  onChange: (spec: MotionSpec, mergeKey?: string) => void;
  onCommit: () => void;
}

/** The label column of a track: its name and its own actions. */
export function TrackLabel({
  spec,
  track,
  trackIndex,
  playhead,
  onChange,
  onSelect,
}: TrackRowProps) {
  const t = useTranslate();
  const name = usePropertyLabel(track.property);
  const offset = spec.duration > 0 ? playhead / spec.duration : 0;
  return (
    <div className="flex h-10 items-center gap-1 pr-2 hairline-bottom">
      <span className="min-w-0 flex-1 truncate text-footnote font-medium text-label" title={name}>
        {name}
        {track.input && (
          <span className="ml-1 text-caption text-label-tertiary">
            {t(
              track.input === "x"
                ? "motionEditor.timeline.followsX"
                : "motionEditor.timeline.followsY",
            )}
          </span>
        )}
      </span>
      <Button
        variant="plain"
        icon={<Plus aria-hidden="true" />}
        label={t("motionEditor.timeline.addKeyframe", { property: name })}
        onClick={() => {
          const added = addKeyframe(spec, trackIndex, offset);
          onChange(added.spec);
          onSelect({ trackIndex, keyframeIndex: added.keyframeIndex });
        }}
      />
      <Button
        variant="plain"
        icon={<Trash2 aria-hidden="true" />}
        label={t("motionEditor.timeline.removeTrack", { property: name })}
        disabled={spec.tracks.length <= 1}
        onClick={() => {
          onSelect(undefined);
          onChange(removeTrack(spec, trackIndex));
        }}
      />
    </div>
  );
}

/**
 * A track's lane: one diamond per keyframe. Drag a diamond to move it in time, or focus it
 * and use the arrow keys (Shift for bigger steps); Delete removes it. Double-click the lane
 * to add a keyframe there.
 */
export function TrackLane({
  spec,
  track,
  trackIndex,
  pixelsPerMillisecond,
  selection,
  onSelect,
  onChange,
  onCommit,
}: TrackRowProps) {
  const t = useTranslate();
  const lane = useRef<HTMLDivElement>(null);
  const name = usePropertyLabel(track.property);
  const width = spec.duration * pixelsPerMillisecond;

  function offsetAtPointer(event: PointerEvent | { clientX: number }) {
    const box = lane.current?.getBoundingClientRect();
    if (!box || box.width === 0) return 0;
    return clamp((event.clientX - box.left) / box.width, 0, 1);
  }

  function drag(event: PointerEvent<HTMLButtonElement>, keyframeIndex: number) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    onChange(
      moveKeyframe(spec, trackIndex, keyframeIndex, offsetAtPointer(event)),
      `move-${trackIndex}-${keyframeIndex}`,
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, keyframeIndex: number) {
    const offset = track.keyframes[keyframeIndex]?.offset ?? 0;
    const step = event.shiftKey ? 0.1 : 0.01;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      onChange(
        moveKeyframe(spec, trackIndex, keyframeIndex, offset + direction * step),
        `move-${trackIndex}-${keyframeIndex}`,
      );
    } else if (
      (event.key === "Delete" || event.key === "Backspace") &&
      track.keyframes.length > 2
    ) {
      event.preventDefault();
      onSelect(undefined);
      onChange(removeKeyframe(spec, trackIndex, keyframeIndex));
    }
  }

  return (
    <div
      ref={lane}
      className="relative h-10 hairline-bottom"
      style={{ width }}
      onDoubleClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const added = addKeyframe(spec, trackIndex, offsetAtPointer(event));
        onChange(added.spec);
        onSelect({ trackIndex, keyframeIndex: added.keyframeIndex });
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent/20"
        style={{
          left: (track.keyframes[0]?.offset ?? 0) * width,
          width:
            ((track.keyframes.at(-1)?.offset ?? 1) - (track.keyframes[0]?.offset ?? 0)) * width,
        }}
      />
      {track.keyframes.map((keyframe, keyframeIndex) => {
        const isSelected =
          selection?.trackIndex === trackIndex && selection.keyframeIndex === keyframeIndex;
        return (
          <button
            // Keyframes have no ids; their position in the track is stable while one is edited.
            key={keyframeIndex}
            type="button"
            aria-pressed={isSelected}
            aria-label={t("motionEditor.timeline.keyframe", {
              number: keyframeIndex + 1,
              count: track.keyframes.length,
              property: name,
              time: formatSeconds(keyframe.offset * spec.duration),
              value: String(keyframe.value),
            })}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              onSelect({ trackIndex, keyframeIndex });
            }}
            onPointerMove={(event) => drag(event, keyframeIndex)}
            onPointerUp={onCommit}
            onFocus={() => onSelect({ trackIndex, keyframeIndex })}
            onKeyDown={(event) => handleKeyDown(event, keyframeIndex)}
            onKeyUp={onCommit}
            className={classNames(
              "absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 cursor-grab touch-none rounded-[3px]",
              "transition-colors duration-150 focus-visible:focus-ring",
              isSelected
                ? "bg-accent-fill ring-2 ring-accent/40"
                : "bg-label-secondary hover:bg-accent",
            )}
            style={{ left: keyframe.offset * width }}
          />
        );
      })}
    </div>
  );
}
