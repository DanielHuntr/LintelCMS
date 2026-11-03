import { reduceMotion } from "../reduced-motion/reducedMotion.js";
import type { MotionSpec } from "../spec/motion.schema.js";
import { resolveTargets } from "../targets/resolveTargets.js";
import { attachTrigger } from "../triggers/attachTrigger.js";
import type { AttachedTrigger } from "../triggers/triggerContext.js";
import { createAnimations } from "./createAnimations.js";
import {
  prefersReducedMotion,
  supportsWebAnimations,
  watchReducedMotion,
  type ReducedMotionPreference,
} from "./environment.js";
import { silentPlayback, type Playback } from "./playback.js";

/**
 * Attaches an animation spec to an element: finds its targets, creates the animations and
 * listens for its trigger. Safe to call anywhere: on the server or in a browser without the
 * Web Animations API it does nothing and the page shows its content as it is styled.
 */

export interface MountOptions {
  /** "auto" follows the device's setting; previews can force either. */
  reducedMotion?: ReducedMotionPreference;
  /** The attribute that holds a builder node's id, for `targets: { type: "nodes" }`. */
  nodeAttribute?: string;
  /** "manual" listens to nothing: the caller plays and seeks. Used by editor previews. */
  mode?: "auto" | "manual";
}

export interface MotionController {
  /** Whether the reduced-motion version is playing. */
  readonly reduced: boolean;
  /** Milliseconds from the first target starting to the last one finishing one run. */
  readonly span: number;
  play(): void;
  reverse(): void;
  pause(): void;
  restart(): void;
  /** Shows one moment, from 0 (start) to 1 (end), and holds it. */
  seek(progress: number): void;
  finish(): void;
  reset(): void;
  finished(): Promise<void>;
  /** For page-exit animations: plays and resolves when done, so the site can navigate. */
  exit(): Promise<void>;
  /** Stops listening and removes every effect, restoring the element. */
  destroy(): void;
}

/** Elements with this attribute start hidden (see motionCloakCss) until their animation is ready. */
export const cloakAttribute = "data-motion-cloak";

interface Mounted {
  reduced: boolean;
  attached: AttachedTrigger;
  teardown(): void;
}

function mountOnce(root: HTMLElement, spec: MotionSpec, options: Required<MountOptions>): Mounted {
  const reduced = prefersReducedMotion(options.reducedMotion);
  const effective = reduced ? reduceMotion(spec) : spec;
  if (!effective || !supportsWebAnimations()) {
    root.removeAttribute(cloakAttribute);
    return {
      reduced,
      attached: { playback: silentPlayback, detach: () => undefined },
      teardown: () => undefined,
    };
  }
  const targets = resolveTargets(root, effective.targets, { nodeAttribute: options.nodeAttribute });
  const playbacks: Playback[] = [];
  const attached = attachTrigger(
    {
      root,
      elements: targets.elements,
      spec: effective,
      nodeAttribute: options.nodeAttribute,
      createPlayback: (scroll) => {
        const playback = createAnimations(targets.elements, effective, scroll);
        playbacks.push(playback);
        return playback;
      },
    },
    options.mode === "manual",
  );
  // The first keyframe is showing now, so the element can stop hiding.
  root.removeAttribute(cloakAttribute);
  return {
    reduced,
    attached,
    teardown: () => {
      attached.detach();
      attached.playback.cancel();
      playbacks.forEach((playback) => playback.cancel());
      targets.restore();
    },
  };
}

export function mountMotion(
  root: HTMLElement,
  spec: MotionSpec,
  options: MountOptions = {},
): MotionController {
  const settings: Required<MountOptions> = {
    reducedMotion: options.reducedMotion ?? "auto",
    nodeAttribute: options.nodeAttribute ?? "data-node-id",
    mode: options.mode ?? "auto",
  };
  let mounted = mountOnce(root, spec, settings);
  const stopWatching =
    settings.reducedMotion === "auto"
      ? watchReducedMotion(() => {
          mounted.teardown();
          mounted = mountOnce(root, spec, settings);
        })
      : () => undefined;
  const playback = () => mounted.attached.playback;

  return {
    get reduced() {
      return mounted.reduced;
    },
    get span() {
      return playback().span;
    },
    play: () => playback().playForward(),
    reverse: () => playback().playBackward(),
    pause: () => playback().pause(),
    restart: () => playback().restart(),
    seek: (progress) => playback().seek(progress),
    finish: () => playback().finish(),
    reset: () => playback().reset(),
    finished: () => playback().finished(),
    exit: () => {
      playback().restart();
      return playback().finished();
    },
    destroy: () => {
      stopWatching();
      mounted.teardown();
    },
  };
}
