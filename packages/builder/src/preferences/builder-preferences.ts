import { createContext, useCallback, useContext, useState } from "react";

/**
 * What the builder remembers about the person using it, on their own device: their skill
 * level, whether they have seen the tour and which tips they closed. The app can pass its own
 * store (tests pass one in memory); by default it is the browser's local storage.
 */

export interface PreferenceStore {
  read(key: string): string | null;
  write(key: string, value: string): void;
}

const prefix = "lintel.builder.";

/** Local storage, quietly doing nothing where it isn't available (private windows, tests). */
export const browserPreferenceStore: PreferenceStore = {
  read: (key) => {
    try {
      return globalThis.localStorage?.getItem(prefix + key) ?? null;
    } catch {
      return null;
    }
  },
  write: (key, value) => {
    try {
      globalThis.localStorage?.setItem(prefix + key, value);
    } catch {
      // Without storage the choice lasts until the page is closed, which is fine.
    }
  },
};

/** A store that forgets everything when the page closes, with some values to start from. */
export function createMemoryPreferenceStore(initial: Record<string, string> = {}): PreferenceStore {
  const values = new Map(Object.entries(initial));
  return {
    read: (key) => values.get(key) ?? null,
    write: (key, value) => void values.set(key, value),
  };
}

/** One remembered value as React state: read once, written whenever it changes. */
export function usePreference<Value extends string>(
  store: PreferenceStore,
  key: string,
  parse: (stored: string | null) => Value,
): [Value, (value: Value) => void] {
  const [value, setValue] = useState(() => parse(store.read(key)));
  const change = useCallback(
    (next: Value) => {
      setValue(next);
      store.write(key, next);
    },
    [store, key],
  );
  return [value, change];
}

/** The store the builder was given, for panels deep inside it (open sections, recent picks). */
export const PreferenceStoreContext = createContext<PreferenceStore>(browserPreferenceStore);

export function usePreferenceStore(): PreferenceStore {
  return useContext(PreferenceStoreContext);
}
