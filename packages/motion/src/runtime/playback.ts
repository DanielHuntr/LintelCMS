/**
 * One animation spec played on its targets: a set of Web Animations (one per target and
 * CSS property) controlled as one. Triggers only ever talk to a Playback, so every trigger
 * plays, reverses and scrubs the same way.
 */

export interface Playback {
  /** Milliseconds from the first target starting to the last one finishing one run. */
  readonly span: number;
  playForward(): void;
  playBackward(): void;
  /** Rewinds to the start and plays. */
  restart(): void;
  pause(): void;
  /** Jumps to a point (0 to 1 of `span`) and holds there. */
  seek(progress: number): void;
  /** Jumps to the end and holds there. */
  finish(): void;
  /** Rewinds to the start and holds there, showing the first keyframe. */
  reset(): void;
  /** Resolves when everything playing now has finished (or was stopped). */
  finished(): Promise<void>;
  /** Removes every effect, leaving the elements as the stylesheet styles them. */
  cancel(): void;
}

export interface AnimationPlaybackOptions {
  animations: Animation[];
  /** Start delay plus duration of one run, per animation, to find the span. */
  spans: number[];
}

function timeOf(animation: Animation): number {
  const time = animation.currentTime;
  return typeof time === "number" ? time : 0;
}

function endOf(animation: Animation): number {
  const end = animation.effect?.getComputedTiming().endTime;
  return typeof end === "number" ? end : 0;
}

function playTowards(animation: Animation, rate: 1 | -1) {
  if (animation.playbackRate !== rate) animation.playbackRate = rate;
  const time = timeOf(animation);
  const atEnd = rate > 0 ? time >= endOf(animation) : time <= 0;
  // play() at the far end would rewind and run again; staying put is what a second hover means.
  if (atEnd && animation.playState !== "idle") return;
  animation.play();
}

export function createAnimationPlayback({ animations, spans }: AnimationPlaybackOptions): Playback {
  const span = Math.max(0, ...spans);
  const each = (action: (animation: Animation) => void) => animations.forEach(action);

  return {
    span,
    playForward: () => each((animation) => playTowards(animation, 1)),
    playBackward: () => each((animation) => playTowards(animation, -1)),
    restart: () =>
      each((animation) => {
        animation.playbackRate = 1;
        animation.currentTime = 0;
        animation.play();
      }),
    pause: () => each((animation) => animation.pause()),
    seek: (progress) =>
      each((animation) => {
        animation.pause();
        animation.currentTime = Math.min(Math.max(progress, 0), 1) * span;
      }),
    finish: () =>
      each((animation) => {
        animation.playbackRate = 1;
        if (Number.isFinite(endOf(animation))) animation.finish();
        else {
          // A forever animation has no end, so it holds at the end of its first run.
          animation.pause();
          animation.currentTime = span;
        }
      }),
    reset: () =>
      each((animation) => {
        animation.playbackRate = 1;
        animation.pause();
        animation.currentTime = 0;
      }),
    finished: () =>
      Promise.all(animations.map((animation) => animation.finished)).then(
        () => undefined,
        () => undefined,
      ),
    cancel: () => each((animation) => animation.cancel()),
  };
}

/** A playback that does nothing: for servers, old browsers and animations reduced to nothing. */
export const silentPlayback: Playback = {
  span: 0,
  playForward: () => undefined,
  playBackward: () => undefined,
  restart: () => undefined,
  pause: () => undefined,
  seek: () => undefined,
  finish: () => undefined,
  reset: () => undefined,
  finished: () => Promise.resolve(),
  cancel: () => undefined,
};

/** A playback that always forwards to the current one, for scenes rebuilt when the screen resizes. */
export function delegatingPlayback(current: () => Playback): Playback {
  return {
    get span() {
      return current().span;
    },
    playForward: () => current().playForward(),
    playBackward: () => current().playBackward(),
    restart: () => current().restart(),
    pause: () => current().pause(),
    seek: (progress) => current().seek(progress),
    finish: () => current().finish(),
    reset: () => current().reset(),
    finished: () => current().finished(),
    cancel: () => current().cancel(),
  };
}
