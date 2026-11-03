import type { PageDrafting } from "@lintel/builder";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCan, useSession } from "../session/SessionContext.js";
import { pageDraftingTools, readDraftingStatus } from "./pageDrafts.api.js";

/**
 * Page drafting for the builder: only while the plugin is on and the person may draft.
 * Undefined otherwise, so the builder shows neither "Draft a page for me" nor "Rewrite this".
 */
export function usePageDrafting(): PageDrafting | undefined {
  const session = useSession();
  const canDraft = useCan("drafts:use");
  const isOn = session.enabledPlugins.includes("drafts") && canDraft;
  const status = useQuery({
    queryKey: ["drafts", "status"],
    queryFn: readDraftingStatus,
    enabled: isOn,
  });
  const isReady = status.data?.ready ?? false;
  return useMemo(() => (isOn ? pageDraftingTools(isReady) : undefined), [isOn, isReady]);
}
