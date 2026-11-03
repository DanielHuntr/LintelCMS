import type { SiteDesign } from "@lintel/builder-model";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCan } from "../session/SessionContext.js";
import { useSiteDesignQuery, useUpdateSiteDesign } from "../website/website.queries.js";

/**
 * The site's design variables and shared styles for the page builder: the saved value,
 * changed at once on screen and saved a moment after the last change (so dragging a colour
 * is one save). People without `builder:blocks` can use them but not change them.
 * Undefined until they have loaded.
 */
export function useSiteDesign():
  { value: SiteDesign; onChange?: (value: SiteDesign) => void } | undefined {
  const canChange = useCan("builder:blocks");
  const saved = useSiteDesignQuery();
  const update = useUpdateSiteDesign();
  const [draft, setDraft] = useState<SiteDesign | null>(null);
  const timer = useRef(0);
  const save = update.mutate;
  const onChange = useCallback(
    (value: SiteDesign) => {
      setDraft(value);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => save(value), 500);
    },
    [save],
  );
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const value = draft ?? saved.data;
  if (!value) return undefined;
  return canChange ? { value, onChange } : { value };
}
