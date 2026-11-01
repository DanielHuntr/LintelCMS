import { useState } from "react";
import { flushSync } from "react-dom";

export type WizardDirection = "forward" | "back";

/**
 * Which screen of a wizard is showing, and a `goTo` that animates the change.
 *
 * The animation uses the browser's View Transitions API: it snapshots the old screen, swaps
 * in the new one, and styles.css slides the new one in from the side it comes from. Browsers
 * without the API (and tests) simply swap screens. Reduced motion is handled in styles.css.
 */
export function useWizardScreens<Screen extends string>(firstScreen: Screen) {
  const [screen, setScreen] = useState(firstScreen);

  function goTo(nextScreen: Screen, direction: WizardDirection = "forward") {
    document.documentElement.dataset.wizardDirection = direction;

    if (typeof document.startViewTransition !== "function") {
      setScreen(nextScreen);
      return;
    }

    // flushSync makes React draw the new screen inside the transition's callback, so the
    // browser captures it as the "after" picture.
    document.startViewTransition(() => flushSync(() => setScreen(nextScreen)));
  }

  return { screen, goTo };
}
