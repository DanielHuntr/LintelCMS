/**
 * Light or dark: the admin follows the device unless the person chose one (from the command
 * palette). The choice is this browser's, kept in localStorage, and applied by setting
 * `data-color-scheme` on <html>, which styles.css and the agency's branding both follow.
 */

export type ColorSchemeChoice = "light" | "dark" | "device";

const STORAGE_KEY = "lintel.colorScheme";

export function readColorSchemeChoice(): ColorSchemeChoice {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : "device";
  } catch {
    // Storage can be switched off; the device decides then.
    return "device";
  }
}

/** Shows the admin in this scheme from now on, and remembers it for next time. */
export function chooseColorScheme(choice: ColorSchemeChoice): void {
  applyColorScheme(choice);
  try {
    if (choice === "device") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Not remembered, but still applied for this visit.
  }
}

/** Sets <html>'s scheme without remembering it: on start, from what was saved. */
export function applyColorScheme(choice: ColorSchemeChoice): void {
  const root = document.documentElement;
  if (choice === "device") delete root.dataset.colorScheme;
  else root.dataset.colorScheme = choice;
}

/** What the admin looks like now: the choice, or the device's setting. */
export function currentColorScheme(choice: ColorSchemeChoice): "light" | "dark" {
  if (choice !== "device") return choice;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
