import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { currentSiteHandle, pickCurrentSite, rememberCurrentSite } from "./currentSite.js";
import { useSites } from "./sites.queries.js";
import type { Site } from "./sites.types.js";

interface CurrentSiteValue {
  /** The site being worked on. */
  site: Site;
  /** Every site the person may work on, the main one first. */
  sites: readonly Site[];
  /** Whether there is more than one, so site choices are worth showing at all. */
  hasSeveralSites: boolean;
  /** Works on another site: every list and editor reloads with its content. */
  switchSite: (handle: string) => Promise<void>;
}

const CurrentSiteContext = createContext<CurrentSiteValue | null>(null);

/**
 * Makes the current site available to every admin screen. The router loads the sites
 * before the admin shows (see `loadSitesForAdmin`), so screens never wait for them.
 */
export function CurrentSiteProvider({
  initialSites,
  children,
}: {
  initialSites: readonly Site[];
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const loaded = useSites();
  const sites = loaded.data ?? initialSites;
  const [handle, setHandle] = useState(currentSiteHandle);
  const site = pickCurrentSite(sites, handle);

  // The site worked on was deleted, or this person lost access to it: the screens already
  // show the one picked instead, and requests follow it from here.
  useEffect(() => {
    if (site && site.handle !== currentSiteHandle()) {
      rememberCurrentSite(site.handle);
    }
  }, [site]);

  const switchSite = useCallback(
    async (next: string) => {
      rememberCurrentSite(next);
      setHandle(next);
      // Everything cached belongs to the old site; fetch it all again for the new one.
      await queryClient.resetQueries();
    },
    [queryClient],
  );

  const value = useMemo(
    () => (site ? { site, sites, hasSeveralSites: sites.length > 1, switchSite } : null),
    [site, sites, switchSite],
  );

  return <CurrentSiteContext.Provider value={value}>{children}</CurrentSiteContext.Provider>;
}

/** The current site, or null outside the signed-in admin (and in screens tested alone). */
export function useCurrentSite(): CurrentSiteValue | null {
  return useContext(CurrentSiteContext);
}
