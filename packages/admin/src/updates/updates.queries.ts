import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useCan } from "../session/SessionContext.js";
import {
  checkForUpdates,
  getAbout,
  getUpdateProgress,
  getUpdates,
  getUpdateStatus,
  getUpdateSummary,
  installUpdate,
  type ReleaseChannel,
  rollBack,
  saveUpdateChannel,
  type UpdateProgress,
  updateProgressStreamUrl,
} from "./updates.api.js";

export const updatesKeys = {
  overview: () => ["updates"] as const,
  summary: () => ["updates", "summary"] as const,
  status: () => ["updates", "status"] as const,
  about: () => ["about"] as const,
};

/** Fifteen minutes: the server only looks for new versions once a day anyway. */
const SUMMARY_STALE_MILLISECONDS = 15 * 60_000;

export function useUpdates() {
  return useQuery({ queryKey: updatesKeys.overview(), queryFn: getUpdates });
}

/** For the sidebar badge and the dashboard widget: nothing is asked without updates:read. */
export function useUpdateSummary() {
  const canRead = useCan("updates:read");
  return useQuery({
    queryKey: updatesKeys.summary(),
    queryFn: getUpdateSummary,
    enabled: canRead,
    staleTime: SUMMARY_STALE_MILLISECONDS,
  });
}

export function useAbout() {
  return useQuery({ queryKey: updatesKeys.about(), queryFn: getAbout, staleTime: Infinity });
}

/** Whether an update is restarting Lintel, for the banner everyone sees. Asked every minute. */
export function useUpdateStatus() {
  return useQuery({
    queryKey: updatesKeys.status(),
    queryFn: getUpdateStatus,
    refetchInterval: (query) => (query.state.data?.updating ? 5_000 : 60_000),
    retry: false,
  });
}

function useRefreshUpdates() {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries({ queryKey: ["updates"] }), [queryClient]);
}

export function useCheckForUpdates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: checkForUpdates,
    onSuccess: (overview) => {
      queryClient.setQueryData(updatesKeys.overview(), overview);
      queryClient.setQueryData(updatesKeys.summary(), overview.summary);
    },
  });
}

export function useSaveUpdateChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (channel: ReleaseChannel) => saveUpdateChannel(channel),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["updates"] }),
  });
}

export function useInstallUpdate() {
  const refresh = useRefreshUpdates();
  return useMutation({ mutationFn: installUpdate, onSuccess: refresh });
}

export function useRollBack() {
  const refresh = useRefreshUpdates();
  return useMutation({
    mutationFn: ({ version, restoreBackup }: { version: string; restoreBackup: boolean }) =>
      rollBack(version, restoreBackup),
    onSuccess: refresh,
  });
}

const POLL_MILLISECONDS = 2_000;

/**
 * Where an update has got to, live. It listens to the API's event stream; when Lintel stops
 * to switch versions the stream ends, and it asks every two seconds instead, which the
 * maintenance page answers too, until the new version (or the old one, after rolling back)
 * is up and says how it ended.
 */
export function useUpdateProgress(initial: UpdateProgress | null, following: boolean) {
  const [streamed, setProgress] = useState<UpdateProgress | null>(null);
  const [restarting, setRestarting] = useState(false);
  const refresh = useRefreshUpdates();

  useEffect(() => {
    if (!following) return;
    let stopped = false;
    let poll: ReturnType<typeof setTimeout> | undefined;
    const events =
      typeof EventSource === "undefined"
        ? null
        : new EventSource(updateProgressStreamUrl, { withCredentials: true });

    const askAgain = () => {
      poll = setTimeout(() => {
        void getUpdateProgress()
          .then(({ progress: latest, maintenance }) => {
            if (stopped) return;
            if (latest) setProgress(latest);
            setRestarting(maintenance);
            if (!maintenance && latest?.finishedAt) {
              void refresh();
              return;
            }
            askAgain();
          })
          .catch(() => {
            // Nothing answers for a moment between the maintenance page and the new version.
            if (!stopped) {
              setRestarting(true);
              askAgain();
            }
          });
      }, POLL_MILLISECONDS);
    };

    if (events) {
      events.addEventListener("progress", (event) => {
        const latest = JSON.parse((event as MessageEvent<string>).data) as UpdateProgress | null;
        if (latest) setProgress(latest);
      });
      events.addEventListener("error", () => {
        events.close();
        if (!stopped && poll === undefined) askAgain();
      });
    } else {
      askAgain();
    }
    return () => {
      stopped = true;
      events?.close();
      clearTimeout(poll);
    };
  }, [following, refresh]);

  // What the stream said, unless the page has since started something newer.
  const progress =
    streamed && (!initial || streamed.startedAt >= initial.startedAt) ? streamed : initial;
  return { progress, restarting };
}
