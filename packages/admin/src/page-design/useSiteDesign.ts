import type { SiteDesign, SiteDesignUses } from "@lintel/builder-model";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { getSiteDesign, type SavedSiteDesign, updateSiteDesign } from "../website/website.api.js";
import {
  useSiteDesignQuery,
  useSiteDesignUsesQuery,
  websiteKeys,
} from "../website/website.queries.js";
import type { SitePartProblem } from "./SitePartProblems.js";

export interface SiteDesignSource {
  /** For the builder: undefined until it has loaded. */
  source:
    | { value: SiteDesign; onChange?: (value: SiteDesign) => void; uses?: SiteDesignUses }
    | undefined;
  /** What went wrong with the last save, to show the person; null when nothing did. */
  problem: SitePartProblem | null;
}

/**
 * The site's design variables and shared styles for the page builder: the saved value,
 * changed at once on screen and saved a moment after the last change (so dragging a colour
 * is one save), and straight away when the builder closes. People without `builder:blocks`
 * can use them but not change them. With them comes where each is used on the rest of the site.
 *
 * Each save sends the revision it started from. When someone else saved in between, the API
 * refuses it; the builder then shows their version and says so, rather than undoing their
 * change. Any other failure is shown with Try again, and the change waits to be sent again.
 */
export function useSiteDesign(
  /** The page (`entry`) or block (`block`) being designed: the builder counts its uses itself. */
  designing: { entry?: string; block?: string } = {},
): SiteDesignSource {
  const canChange = useCan("builder:blocks");
  const saved = useSiteDesignQuery();
  const uses = useSiteDesignUsesQuery(designing).data;
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SiteDesign | null>(null);
  const [problem, setProblem] = useState<SitePartProblem | null>(null);
  const pending = useRef<SiteDesign | null>(null);
  const isSaving = useRef(false);
  const revision = useRef<string | null | undefined>(undefined);
  const timer = useRef(0);
  // The latest flush, for timers and saves that finish after a render.
  const flushRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (revision.current === undefined && saved.data) revision.current = saved.data.revision;
  }, [saved.data]);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    // One save at a time, so each starts from the revision the last one made.
    if (isSaving.current) return;
    const value = pending.current;
    if (!value) return;
    pending.current = null;
    isSaving.current = true;
    const showLatest = async () => {
      const latest = await queryClient.fetchQuery({
        queryKey: websiteKeys.design(),
        queryFn: getSiteDesign,
        staleTime: 0,
      });
      revision.current = latest.revision;
      pending.current = null;
      setDraft(null);
    };
    void updateSiteDesign(value, revision.current)
      .then(
        (result: SavedSiteDesign) => {
          revision.current = result.revision;
          setProblem(null);
          queryClient.setQueryData(websiteKeys.design(), result);
          return true;
        },
        async (error: unknown) => {
          if (error instanceof ApiError && error.code === "SITE_DESIGN_CHANGED") {
            await showLatest().catch(() => undefined);
            setProblem({ message: t("pageDesign.siteStyles.changedElsewhere") });
            return false;
          }
          // Keep the change for the next try, unless a newer one is already waiting.
          pending.current ??= value;
          setProblem({
            message: t("pageDesign.siteStyles.notSaved", {
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
        if (succeeded && pending.current) flushRef.current();
      });
  }, [queryClient]);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const onChange = useCallback((value: SiteDesign) => {
    setDraft(value);
    pending.current = value;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => flushRef.current(), 500);
  }, []);
  // A change still waiting when the builder closes is saved then, not lost.
  useEffect(() => () => flushRef.current(), []);

  const value = draft ?? withoutRevision(saved.data);
  if (!value) return { source: undefined, problem };
  return { source: canChange ? { value, onChange, uses } : { value, uses }, problem };
}

function withoutRevision(saved: SavedSiteDesign | undefined): SiteDesign | undefined {
  if (!saved) return undefined;
  return Object.fromEntries(
    Object.entries(saved).filter(([key]) => key !== "revision"),
  ) as SiteDesign;
}
