import { mountMotion, type MotionSpec } from "@lintel/motion";
import { useEffect, useState } from "react";

/**
 * Mounts a spec on an element with its real trigger, as a published page would.
 * Changing `replayKey` mounts it again, which replays load and scroll-into-view animations.
 */
export function useMountedMotion(spec: MotionSpec | null, replayKey = 0) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!element || !spec) return;
    const controller = mountMotion(element, spec);
    return () => controller.destroy();
  }, [element, spec, replayKey]);
  return setElement;
}
