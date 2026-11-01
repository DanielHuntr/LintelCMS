import type { ScrollTrigger } from "../spec/trigger.schema.js";
import type { ScrollTimelineBinding } from "../runtime/createAnimations.js";
import { supportsScrollTimelines } from "../runtime/environment.js";
import { delegatingPlayback, type Playback } from "../runtime/playback.js";
import {
  markerScrollOffset,
  pageProgress,
  pinScene,
  pinnedSceneMarkers,
  sceneProgress,
} from "../runtime/scrollScene.js";
import { listen, type AttachedTrigger, type TriggerContext } from "./triggerContext.js";

/**
 * Scroll scenes: the animation follows the scroll position instead of the clock.
 *
 * Where the browser has scroll-driven animations (ScrollTimeline and ViewTimeline) it runs
 * the scene itself, off the main thread. Elsewhere, and for staggered scenes (which the
 * browser's timelines can't offset per target), Lintel listens to scroll and, once per
 * frame, reads the element's position and then sets the animations' time: one read, then
 * writes, so the page is never laid out twice in a frame.
 */

function markersOf(trigger: ScrollTrigger) {
  return trigger.pin ? pinnedSceneMarkers : trigger;
}

function nativeBinding(root: HTMLElement, trigger: ScrollTrigger): ScrollTimelineBinding {
  const document = root.ownerDocument;
  if (trigger.scope === "page") {
    return { timeline: new ScrollTimeline({ source: document.documentElement, axis: "block" }) };
  }
  const { start, end } = markersOf(trigger);
  const elementHeight = root.offsetHeight;
  const viewportHeight = document.documentElement.clientHeight;
  const offset = (marker: typeof start) =>
    CSS.px(markerScrollOffset(marker, elementHeight, viewportHeight));
  return {
    timeline: new ViewTimeline({ subject: root, axis: "block" }),
    rangeStart: { rangeName: "cover", offset: offset(start) },
    rangeEnd: { rangeName: "cover", offset: offset(end) },
  };
}

function canRunNatively(context: TriggerContext, manual: boolean): boolean {
  return (
    !manual &&
    supportsScrollTimelines() &&
    typeof CSS.px === "function" &&
    context.spec.stagger.each === 0
  );
}

function progressNow(root: HTMLElement, trigger: ScrollTrigger): number {
  const document = root.ownerDocument;
  const viewportHeight = document.documentElement.clientHeight;
  if (trigger.scope === "page") {
    const scroller = document.scrollingElement ?? document.documentElement;
    return pageProgress(scroller.scrollTop, scroller.scrollHeight, viewportHeight);
  }
  const rect = root.getBoundingClientRect();
  return sceneProgress(markersOf(trigger), {
    elementTop: rect.top,
    elementHeight: rect.height,
    viewportHeight,
  });
}

/**
 * `manual` is for previews: the scene only moves when seeked, and isn't pinned.
 */
export function attachScroll(
  context: TriggerContext,
  trigger: ScrollTrigger,
  manual: boolean,
): AttachedTrigger {
  const { root } = context;
  const window = root.ownerDocument.defaultView;
  // Previews show the scene in a small box, where pinning to the screen would make no sense.
  const unpin = trigger.pin && !manual ? pinScene(root, trigger.pin.length) : () => undefined;

  if (canRunNatively(context, manual) && window) {
    let playback: Playback = context.createPlayback(nativeBinding(root, trigger));
    let frame = 0;
    // Marker offsets are in pixels, so they are worked out again when the screen changes size.
    const stopResize = listen(window, {
      resize: () => {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => {
          playback.cancel();
          playback = context.createPlayback(nativeBinding(root, trigger));
        });
      },
    });
    return {
      playback: delegatingPlayback(() => playback),
      detach: () => {
        stopResize();
        window.cancelAnimationFrame(frame);
        unpin();
      },
    };
  }

  const playback = context.createPlayback();
  if (manual || !window) return { playback, detach: unpin };
  let frame = 0;
  const update = () => {
    frame = 0;
    playback.seek(progressNow(root, trigger));
  };
  const schedule = () => {
    if (frame === 0) frame = window.requestAnimationFrame(update);
  };
  const stopListening = listen(window, { scroll: schedule, resize: schedule });
  update();
  return {
    playback,
    detach: () => {
      stopListening();
      if (frame !== 0) window.cancelAnimationFrame(frame);
      unpin();
    },
  };
}
