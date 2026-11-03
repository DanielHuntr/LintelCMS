import type { SiteSectionsChange } from "@lintel/builder-model";
import type { SiteSectionsSource } from "@lintel/builder";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { useCan } from "../session/SessionContext.js";
import { updateSiteSections } from "../website/website.api.js";
import { useSiteSectionsQuery, websiteKeys } from "../website/website.queries.js";

/**
 * The site's navigation and footer for the page builder (see site-sections/ in the model):
 * shown on every page and edited from any of them. Changes are saved a moment after the
 * last one, and straight away when the builder closes. People without `builder:blocks` see
 * them but can't change them. `isLoading` holds the builder back, since the page opens with
 * them in it; if they can't be read, the builder opens without them.
 */
export function useSiteSections(): { isLoading: boolean; source: SiteSectionsSource | undefined } {
  const canChange = useCan("builder:blocks");
  const saved = useSiteSectionsQuery();
  const queryClient = useQueryClient();
  const pending = useRef<SiteSectionsChange>({});
  const timer = useRef(0);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const change = pending.current;
    pending.current = {};
    if (Object.keys(change).length === 0) return;
    void updateSiteSections(change).then(
      (sections) => queryClient.setQueryData(websiteKeys.sections(), sections),
      () => undefined,
    );
  }, [queryClient]);

  const onChange = useCallback(
    (change: SiteSectionsChange) => {
      pending.current = { ...pending.current, ...change };
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 500);
    },
    [flush],
  );
  useEffect(() => flush, [flush]);

  if (saved.isPending) return { isLoading: true, source: undefined };
  if (!saved.data) return { isLoading: false, source: undefined };
  return {
    isLoading: false,
    source: canChange ? { value: saved.data, onChange } : { value: saved.data },
  };
}
