import {
  applyLeaveBehaviour,
  listen,
  type AttachedTrigger,
  type TriggerContext,
} from "./triggerContext.js";

/**
 * Triggers that answer one thing the visitor does: the page loading, hovering, clicking,
 * focusing, a custom event, or leaving the page.
 */

export function attachLoad(context: TriggerContext): AttachedTrigger {
  const playback = context.createPlayback();
  playback.playForward();
  return { playback, detach: () => undefined };
}

export function attachHover(
  context: TriggerContext,
  onLeave: "stay" | "reverse" | "reset",
): AttachedTrigger {
  const playback = context.createPlayback();
  const detach = listen(context.root, {
    pointerenter: () => playback.playForward(),
    pointerleave: () => applyLeaveBehaviour(onLeave, playback),
  });
  return { playback, detach };
}

export function attachFocus(
  context: TriggerContext,
  onLeave: "stay" | "reverse" | "reset",
): AttachedTrigger {
  const playback = context.createPlayback();
  const detach = listen(context.root, {
    focusin: () => playback.playForward(),
    focusout: (event) => {
      // Moving focus between two things inside the element isn't leaving it.
      const next = event instanceof FocusEvent ? event.relatedTarget : null;
      if (next instanceof Node && context.root.contains(next)) return;
      applyLeaveBehaviour(onLeave, playback);
    },
  });
  return { playback, detach };
}

export function attachClick(context: TriggerContext, toggle: boolean): AttachedTrigger {
  const playback = context.createPlayback();
  let forwards = false;
  const detach = listen(context.root, {
    click: () => {
      if (!toggle) return playback.restart();
      forwards = !forwards;
      if (forwards) playback.playForward();
      else playback.playBackward();
    },
  });
  return { playback, detach };
}

export function attachEvent(
  context: TriggerContext,
  name: string,
  listenOn: "self" | "document",
): AttachedTrigger {
  const playback = context.createPlayback();
  const target = listenOn === "self" ? context.root : context.root.ownerDocument;
  const detach = listen(target, { [name]: () => playback.restart() });
  return { playback, detach };
}

/** Page exits don't listen to anything: the site calls `exit()` before it navigates. */
export function attachPageExit(context: TriggerContext): AttachedTrigger {
  return { playback: context.createPlayback(), detach: () => undefined };
}
