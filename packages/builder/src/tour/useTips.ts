import { useCallback, useMemo, useState } from "react";
import type { PreferenceStore } from "../preferences/builder-preferences.js";

const key = "dismissedTips";

/** Which tips someone has closed, remembered on their device; `showAgain` brings them back. */
export function useTips(store: PreferenceStore) {
  const [dismissed, setDismissed] = useState(
    () => new Set((store.read(key) ?? "").split(",").filter(Boolean)),
  );
  const save = useCallback(
    (next: Set<string>) => {
      setDismissed(next);
      store.write(key, [...next].join(","));
    },
    [store],
  );
  return useMemo(
    () => ({
      isDismissed: (tip: string) => dismissed.has(tip),
      dismiss: (tip: string) => save(new Set([...dismissed, tip])),
      showAgain: () => save(new Set()),
    }),
    [dismissed, save],
  );
}
