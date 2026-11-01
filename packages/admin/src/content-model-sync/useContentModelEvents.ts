import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useCan } from "../session/SessionContext.js";
import { contentModelEventsUrl } from "./contentModelSync.api.js";
import { contentModelQueryKeys, contentModelSyncKeys } from "./contentModelSync.queries.js";

/**
 * Listens for the API saying the content model changed (a developer saved a file, or
 * someone else made a change) and reloads what shows it, so screens never stay out of
 * date. The browser reconnects by itself if the connection drops.
 */
export function useContentModelEvents(): void {
  const queryClient = useQueryClient();
  const canRead = useCan("blueprints:read");

  useEffect(() => {
    if (!canRead || typeof EventSource === "undefined") {
      return;
    }
    const events = new EventSource(contentModelEventsUrl, { withCredentials: true });
    const reloadModel = () => {
      for (const queryKey of contentModelQueryKeys) {
        void queryClient.invalidateQueries({ queryKey });
      }
    };
    const reloadStatus = () =>
      void queryClient.invalidateQueries({ queryKey: contentModelSyncKeys.status() });
    events.addEventListener("model-changed", reloadModel);
    events.addEventListener("status-changed", reloadStatus);
    return () => events.close();
  }, [canRead, queryClient]);
}
