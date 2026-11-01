import { attachInView } from "./inViewTrigger.js";
import {
  attachClick,
  attachEvent,
  attachFocus,
  attachHover,
  attachLoad,
  attachPageExit,
} from "./interactionTriggers.js";
import { attachPointer } from "./pointerTrigger.js";
import { attachScroll } from "./scrollTrigger.js";
import type { AttachedTrigger, TriggerContext } from "./triggerContext.js";

/**
 * Every trigger, in one visible list. In manual mode (editor previews) nothing listens:
 * the animations wait at their first keyframe for the caller to play or seek them.
 * Scroll and pointer scenes have their own manual modes, because they can be seeked
 * but aren't driven by time.
 */
export function attachTrigger(context: TriggerContext, manual: boolean): AttachedTrigger {
  const { trigger } = context.spec;
  if (trigger.type === "scroll") return attachScroll(context, trigger, manual);
  if (trigger.type === "pointer") return attachPointer(context, trigger, manual);
  if (manual) return { playback: context.createPlayback(), detach: () => undefined };
  switch (trigger.type) {
    case "load":
      return attachLoad(context);
    case "inView":
      return attachInView(context, trigger);
    case "hover":
      return attachHover(context, trigger.onLeave);
    case "click":
      return attachClick(context, trigger.toggle);
    case "focus":
      return attachFocus(context, trigger.onLeave);
    case "event":
      return attachEvent(context, trigger.name, trigger.listenOn);
    case "pageExit":
      return attachPageExit(context);
  }
}
