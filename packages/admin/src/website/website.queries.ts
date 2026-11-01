import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCanvasSite, getSiteAddress, getWebsite, updateWebsite } from "./website.api.js";

export const websiteKeys = {
  settings: () => ["website", "settings"] as const,
  address: () => ["website", "address"] as const,
  canvas: () => ["website", "canvas"] as const,
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

/** The website's look for the page builder's canvas. Changes to the look refresh it. */
export function useCanvasSite() {
  return useQuery({ queryKey: websiteKeys.canvas(), queryFn: getCanvasSite, retry: false });
}
