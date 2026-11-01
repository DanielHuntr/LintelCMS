import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSiteAddress, getWebsite, updateWebsite } from "./website.api.js";

export const websiteKeys = {
  settings: () => ["website", "settings"] as const,
  address: () => ["website", "address"] as const,
};

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
