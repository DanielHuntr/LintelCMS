import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type BrandingSettings,
  fetchBrandingSettings,
  fetchPublicBranding,
  resetBranding,
  saveBranding,
} from "./branding.api.js";
import { showBranding } from "./brandingStore.js";

export const brandingKeys = {
  settings: () => ["branding", "settings"] as const,
};

export function useBrandingSettings() {
  return useQuery({ queryKey: brandingKeys.settings(), queryFn: fetchBrandingSettings });
}

/** After saving or resetting, every screen switches to the new look at once. */
function useBrandingChange<Input>(change: (input: Input) => Promise<BrandingSettings>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: change,
    onSuccess: async (settings) => {
      queryClient.setQueryData(brandingKeys.settings(), settings);
      showBranding(await fetchPublicBranding());
    },
  });
}

export function useSaveBranding() {
  return useBrandingChange(saveBranding);
}

export function useResetBranding() {
  return useBrandingChange((_: void) => resetBranding());
}
