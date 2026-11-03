import type { SiteSectionsChange } from "@lintel/builder-model";
import type { SiteSectionsSource } from "@lintel/builder";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { updateSiteSections } from "../website/website.api.js";
import { useSiteSectionsQuery, websiteKeys } from "../website/website.queries.js";
import type { SitePartProblem } from "./SitePartProblems.js";

/**
 * The site's navigation and footer for the page builder (see site-sections/ in the model):
 * shown on every page and edited from any of them. Changes are saved a moment after the
 * last one, and straight away when the builder closes. People without `builder:blocks` see
 * them but can't change them. `isLoading` holds the builder back, since the page opens with
 * them in it; if they can't be read, the builder opens without them. A save that fails is
 * shown with Try again, and the change waits to be sent again.
 */
export function useSiteSections(): {
  isLoading: boolean;
  source: SiteSectionsSource | undefined;
  problem: SitePartProblem | null;
} {
  const canChange = useCan("builder:blocks");
  const saved = useSiteSectionsQuery();
  const queryClient = useQueryClient();
  const [problem, setProblem] = useState<SitePartProblem | null>(null);
  const pending = useRef<SiteSectionsChange>({});
  const isSaving = useRef(false);
  const timer = useRef(0);
  // The latest flush, for timers and saves that finish after a render.
  const flushRef = useRef<() => void>(() => undefined);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    if (isSaving.current) return;
    const change = pending.current;
    if (Object.keys(change).length === 0) return;
    pending.current = {};
    isSaving.current = true;
    void updateSiteSections(change)
      .then(
        (sections) => {
          setProblem(null);
          queryClient.setQueryData(websiteKeys.sections(), sections);
          return true;
        },
        (error: unknown) => {
          // Keep the change for the next try; a newer change to the same slot wins.
          pending.current = { ...change, ...pending.current };
          setProblem({
            message: t("pageDesign.siteSections.notSaved", {
              message: error instanceof Error ? error.message : String(error),
            }),
            retry: () => flushRef.current(),
          });
          return false;
        },
      )
      .then((succeeded) => {
        isSaving.current = false;
        // Changes made meanwhile go next. After a failure they wait for Try again, the next
        // change or the builder closing, so a server that keeps refusing isn't asked again
        // and again.
        if (succeeded && Object.keys(pending.current).length > 0) flushRef.current();
      });
  }, [queryClient]);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const onChange = useCallback((change: SiteSectionsChange) => {
    pending.current = { ...pending.current, ...change };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => flushRef.current(), 500);
  }, []);
  useEffect(() => () => flushRef.current(), []);

  if (saved.isPending) return { isLoading: true, source: undefined, problem };
  if (!saved.data) return { isLoading: false, source: undefined, problem };
  return {
    isLoading: false,
    source: canChange ? { value: saved.data, onChange } : { value: saved.data },
    problem,
  };
}
