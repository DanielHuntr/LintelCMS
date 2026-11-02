import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Tone } from "../design/tones.js";

/** One row of Settings: where it goes and how it reads. */
export interface SettingsEntry {
  key: string;
  icon: LucideIcon;
  iconTone?: Tone;
  label: string;
  description: string;
  to: string;
  accessory?: ReactNode;
}

export interface SettingsGroup {
  header: string;
  entries: SettingsEntry[];
}

/** A plugin's row and the group it asked for (`SettingsRow` in plugins/adminPlugin.ts). */
export interface PluginEntry extends SettingsEntry {
  group: string;
}

/**
 * The groups Settings shows, in order. A plugin's row joins the first group, the website's
 * own, unless its plugin brings a group of two or more rows: a header over a single row
 * ("Search engines" over "Search engines") only makes the list longer. Empty groups go.
 */
export function arrangeSettings(
  groups: readonly SettingsGroup[],
  pluginEntries: readonly PluginEntry[],
): SettingsGroup[] {
  const byGroup = new Map<string, SettingsEntry[]>();
  for (const { group, ...entry } of pluginEntries) {
    byGroup.set(group, [...(byGroup.get(group) ?? []), entry]);
  }
  const loose = [...byGroup].filter(([, entries]) => entries.length < 2).flatMap(([, e]) => e);
  const ownGroups = [...byGroup]
    .filter(([, entries]) => entries.length >= 2)
    .map(([header, entries]) => ({ header, entries }));
  const [first, ...rest] = groups;
  const arranged = first
    ? [{ ...first, entries: [...first.entries, ...loose] }, ...ownGroups, ...rest]
    : [...ownGroups];
  return arranged.filter((group) => group.entries.length > 0);
}

/** The groups with only the rows whose name or description has every word searched for. */
export function searchSettings(groups: readonly SettingsGroup[], search: string): SettingsGroup[] {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...groups];
  return groups
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) => {
        const text = `${entry.label} ${entry.description} ${group.header}`.toLowerCase();
        return words.every((word) => text.includes(word));
      }),
    }))
    .filter((group) => group.entries.length > 0);
}
