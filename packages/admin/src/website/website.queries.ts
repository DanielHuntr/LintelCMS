import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getBuilderData,
  getCanvasSite,
  getSiteAddress,
  getSiteDesign,
  getSiteEffects,
  getSiteSections,
  getWebsite,
  updateSiteEffects,
  updateWebsite,
} from "./website.api.js";

export const websiteKeys = {
  settings: () => ["website", "settings"] as const,
  address: () => ["website", "address"] as const,
  canvas: () => ["website", "canvas"] as const,
  builderData: () => ["website", "builder-data"] as const,
  effects: () => ["website", "effects"] as const,
  design: () => ["website", "design"] as const,
  sections: () => ["website", "sections"] as const,
};

/** The site's navigation and footer sections. */
export function useSiteSectionsQuery() {
  return useQuery({ queryKey: websiteKeys.sections(), queryFn: getSiteSections, retry: false });
}

/** The site's design variables and shared styles. */
export function useSiteDesignQuery() {
  return useQuery({ queryKey: websiteKeys.design(), queryFn: getSiteDesign, retry: false });
}

/** The site-wide motion settings. */
export function useSiteEffects() {
  return useQuery({ queryKey: websiteKeys.effects(), queryFn: getSiteEffects, retry: false });
}

export function useUpdateSiteEffects() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSiteEffects,
    onSuccess: (settings) => queryClient.setQueryData(websiteKeys.effects(), settings),
  });
}

export function useWebsite() {
  return useQuery({ queryKey: websiteKeys.settings(), queryFn: getWebsite });
}

export function useUpdateWebsite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateWebsite,
    onSuccess: (website) => {
      queryClient.setQueryData(websiteKeys.settings(), website);
      void queryClient.invalidateQueries({ queryKey: websiteKeys.address() });
    },
  });
}

/** Where the site is, for "View page". Anyone signed in may ask. */
export function useSiteAddress() {
  return useQuery({ queryKey: websiteKeys.address(), queryFn: getSiteAddress, staleTime: 60_000 });
}

/**
 * The site for `viewPageTarget`: undefined while loading, and "no website" if the address
 * can't be fetched, so View page still offers Lintel's simple preview.
 */
export function useViewPageSite():
  { siteAddress: string | null; defaultLocale: string } | undefined {
  const address = useSiteAddress();
  if (address.isError) return { siteAddress: null, defaultLocale: "" };
  return address.data;
}

/** The website's look for the page builder's canvas. Changes to the look refresh it. */
/** What the builder's collection lists and shop elements can show; refreshed on each visit. */
export function useBuilderData() {
  return useQuery({ queryKey: websiteKeys.builderData(), queryFn: getBuilderData, retry: false });
}

export function useCanvasSite() {
  return useQuery({ queryKey: websiteKeys.canvas(), queryFn: getCanvasSite, retry: false });
}
