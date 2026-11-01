import { useMemo, useState } from "react";
import type { PreferenceStore } from "./builder-preferences.js";

/**
 * Which collapsible sections of a panel are open, remembered on the device. Sections are
 * named by short ids ("layout", "spacing"), stored as a comma-separated list.
 */
export interface OpenSections {
  isOpen: (sectionId: string) => boolean;
  toggle: (sectionId: string) => void;
  /** Called when someone works inside a section (focus moves into it). */
  markUsed: (sectionId: string) => void;
  /**
   * Locks the controls inside every section while the headings still open and close, so a
   * locked element's styles can be looked at but not changed.
   */
  isContentDisabled?: boolean;
}

function readList(stored: string | null): string[] | null {
  return stored === null ? null : stored.split(",").filter(Boolean);
}

function toggled(current: ReadonlySet<string>, sectionId: string): Set<string> {
  const next = new Set(current);
  if (next.has(sectionId)) next.delete(sectionId);
  else next.add(sectionId);
  return next;
}

/**
 * Every section's open or closed state is remembered: what was open last time is open
 * again. `defaultOpen` is what someone sees the very first time.
 */
export function useRememberedOpenSections(
  store: PreferenceStore,
  key: string,
  defaultOpen: readonly string[],
): OpenSections {
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(readList(store.read(key)) ?? defaultOpen),
  );
  return useMemo(
    () => ({
      isOpen: (sectionId) => open.has(sectionId),
      toggle: (sectionId) => {
        const next = toggled(open, sectionId);
        setOpen(next);
        store.write(key, [...next].join(","));
      },
      markUsed: () => undefined,
    }),
    [open, store, key],
  );
}

/**
 * Everything starts closed except the section used last, so a long panel opens short and
 * still has the one thing someone was working on ready. Within a visit, sections stay as
 * they are left.
 */
export function useLastUsedOpenSections(store: PreferenceStore, key: string): OpenSections {
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(readList(store.read(key))?.slice(0, 1) ?? []),
  );
  return useMemo(() => {
    const remember = (sectionId: string) => {
      if (store.read(key) !== sectionId) store.write(key, sectionId);
    };
    return {
      isOpen: (sectionId) => open.has(sectionId),
      toggle: (sectionId) => {
        const next = toggled(open, sectionId);
        setOpen(next);
        if (next.has(sectionId)) remember(sectionId);
      },
      markUsed: remember,
    };
  }, [open, store, key]);
}
