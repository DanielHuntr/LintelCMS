import { type MarkChange, sharedMarkStyles, type TextMark } from "@lintel/builder-model";

/** The styles Bold and Italic put on words, for the bar's buttons and Mod+B / Mod+I. */
const toggles = {
  bold: { fontWeight: "700" },
  italic: { fontStyle: "italic" },
} as const;

export type MarkToggle = keyof typeof toggles;

/** Whether every selected letter already has the style. */
export function isToggleOn(
  marks: readonly TextMark[],
  from: number,
  to: number,
  toggle: MarkToggle,
): boolean {
  const shared: Readonly<Record<string, string | undefined>> = sharedMarkStyles(marks, from, to);
  return Object.entries(toggles[toggle]).every(([name, value]) => shared[name] === value);
}

/** The change a press makes: takes the style off when it's all on, else puts it on. */
export function toggleChange(
  marks: readonly TextMark[],
  from: number,
  to: number,
  toggle: MarkToggle,
): MarkChange {
  const styles = toggles[toggle];
  return isToggleOn(marks, from, to, toggle)
    ? Object.fromEntries(Object.keys(styles).map((name) => [name, undefined]))
    : { ...styles };
}
