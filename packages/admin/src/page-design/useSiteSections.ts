import type { SiteSections, SiteSectionsChange } from "@lintel/builder-model";
import type { SiteSectionsSource } from "@lintel/builder";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import {
  publishSiteSections,
  type SiteSectionsDraft,
  updateSiteSections,
} from "../website/website.api.js";
import { useSiteSectionsQuery, websiteKeys } from "../website/website.queries.js";
import type { SitePartProblem } from "./SitePartProblems.js";

export interface SiteSectionsState {
  isLoading: boolean;
  source: SiteSectionsSource | undefined;
  problem: SitePartProblem | null;
  /** Changes to them wait to be published: the website still shows the last published ones. */
  unpublished: boolean;
  /** Saves any change still waiting, then puts the changes on the website. */
  publish: () => Promise<void>;
}

/**
 * The site's navigation and footer for the page builder (see site-sections/ in the model):
 * shown on every page and edited from any of them. Changes are saved as a draft a moment
 * after the last one, and straight away when the builder closes; the website keeps showing
 * the published ones until the page is published (`publish`). People without
 * `builder:blocks` see them but can't change them. `isLoading` holds the builder back, since
 * the page opens with them in it; if they can't be read, the builder opens without them. A
 * save that fails is shown with Try again, and the change waits to be sent again.
 */
export function useSiteSections(): SiteSectionsState {
  const canChange = useCan("builder:blocks");
  const saved = useSiteSectionsQuery();
  const queryClient = useQueryClient();
  const [problem, setProblem] = useState<SitePartProblem | null>(null);
  const pending = useRef<SiteSectionsChange>({});
  // The save under way, so publishing can wait for it.
  const saving = useRef<Promise<boolean> | null>(null);
  const timer = useRef(0);
  // The latest flush, for timers and saves that finish after a render.
  const flushRef = useRef<() => Promise<boolean>>(async () => true);

  const flush = useCallback((): Promise<boolean> => {
    window.clearTimeout(timer.current);
    // One save at a time; changes made meanwhile go when it finishes.
    if (saving.current) return saving.current;
    const change = pending.current;
    if (Object.keys(change).length === 0) return Promise.resolve(true);
    pending.current = {};
    const save = updateSiteSections(change)
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
            retry: () => void flushRef.current(),
          });
          return false;
        },
      )
      .then((succeeded) => {
        saving.current = null;
        // Changes made meanwhile go next. After a failure they wait for Try again, the next
        // change or the builder closing, so a server that keeps refusing isn't asked again
        // and again.
        return succeeded && Object.keys(pending.current).length > 0
          ? flushRef.current()
          : succeeded;
      });
    saving.current = save;
    return save;
  }, [queryClient]);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const onChange = useCallback((change: SiteSectionsChange) => {
    pending.current = { ...pending.current, ...change };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flushRef.current(), 500);
  }, []);
  useEffect(() => () => void flushRef.current(), []);

  const publish = useCallback(async () => {
    if (!(await flushRef.current())) {
      throw new Error(t("pageDesign.siteSections.notPublished"));
    }
    const latest = queryClient.getQueryData<SiteSectionsDraft>(websiteKeys.sections());
    if (!latest?.unpublished) return;
    await publishSiteSections();
    queryClient.setQueryData<SiteSectionsDraft>(websiteKeys.sections(), {
      ...latest,
      unpublished: false,
    });
  }, [queryClient]);

  // The builder gets the sections alone, the same object while they don't change.
  const value = useMemo<SiteSections | undefined>(
    () =>
      saved.data ? { navigation: saved.data.navigation, footer: saved.data.footer } : undefined,
    [saved.data],
  );
  const unpublished = saved.data?.unpublished === true;

  if (saved.isPending) {
    return { isLoading: true, source: undefined, problem, unpublished, publish };
  }
  if (!value) return { isLoading: false, source: undefined, problem, unpublished, publish };
  return {
    isLoading: false,
    source: canChange ? { value, onChange } : { value },
    problem,
    unpublished,
    publish,
  };
}
