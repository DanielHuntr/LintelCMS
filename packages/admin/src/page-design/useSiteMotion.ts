import type { SiteEffectSettings } from "@lintel/motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCan } from "../session/SessionContext.js";
import { useSiteEffects, useUpdateSiteEffects } from "../website/website.queries.js";

/**
 * The site-wide motion settings for the builder's Animate tab: the saved value, changed at
 * once on screen and saved a moment after the last change (so a slider drag is one save).
 * Undefined for people who can't change site settings, or until the settings have loaded.
 */
export function useSiteMotion() {
  const canChange = useCan("settings:update");
  const saved = useSiteEffects();
  const update = useUpdateSiteEffects();
  const [draft, setDraft] = useState<SiteEffectSettings | null>(null);
  const timer = useRef(0);
  const save = update.mutate;
  const onChange = useCallback(
    (value: SiteEffectSettings) => {
      setDraft(value);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => save(value), 500);
    },
    [save],
  );
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const value = draft ?? saved.data;
  return canChange && value ? { value, onChange } : undefined;
}
