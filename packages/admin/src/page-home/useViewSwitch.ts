import { useRef, useState } from "react";
import type { PageView } from "./pageViews.js";

interface ViewSwitchOptions {
  /** The view on screen now. */
  current: PageView;
  /** Saves what going to that view would leave behind, and says whether it all went. */
  saveFirst: (view: PageView) => Promise<boolean>;
  go: (view: PageView) => Promise<void> | void;
}

/** Long enough for an edit still on its way from the canvas frame to arrive. */
const nextTask = () => new Promise((resolve) => setTimeout(resolve));

/**
 * Moving between a page's views. It only moves once everything is saved: if a save fails the
 * person stays where they are with their edits, and `didFail` says so. Presses made meanwhile
 * don't start anything new; the last one says where to go, so a double press moves once and
 * changing your mind is respected.
 */
export function useViewSwitch({ current, saveFirst, go }: ViewSwitchOptions) {
  const wanted = useRef<PageView>(current);
  const isSwitching = useRef(false);
  const [didFail, setDidFail] = useState(false);

  async function request(view: PageView) {
    wanted.current = view;
    if (isSwitching.current) return;
    isSwitching.current = true;
    setDidFail(false);
    try {
      await nextTask();
      let target: PageView;
      do {
        target = wanted.current;
        if (!(await saveFirst(target))) {
          setDidFail(true);
          wanted.current = current;
          return;
        }
      } while (target !== wanted.current);
      if (target !== current) await go(target);
    } finally {
      isSwitching.current = false;
    }
  }

  return { request, didFail };
}
