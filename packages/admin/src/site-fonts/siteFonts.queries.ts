import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { websiteKeys } from "../website/website.queries.js";
import {
  addGoogleFont,
  addUploadedFont,
  connectAdobeProject,
  disconnectAdobeProject,
  getSiteFonts,
  loadFontFile,
  removeSiteFont,
  type SiteFonts,
} from "./siteFonts.api.js";

export const siteFontsKey = ["site-fonts"] as const;

/** `enabled` false waits until the list is needed (the builder only needs it to add a font). */
export function useSiteFonts(enabled = true) {
  return useQuery({ queryKey: siteFontsKey, queryFn: getSiteFonts, enabled });
}

/** After any change: the font list, and the builder's canvas, which draws with them. */
function useRefreshFonts() {
  const queryClient = useQueryClient();
  return (fonts?: SiteFonts) => {
    if (fonts) queryClient.setQueryData(siteFontsKey, fonts);
    void queryClient.invalidateQueries({ queryKey: siteFontsKey });
    void queryClient.invalidateQueries({ queryKey: websiteKeys.canvas() });
  };
}

export function useAddUploadedFont() {
  const refresh = useRefreshFonts();
  return useMutation({ mutationFn: addUploadedFont, onSuccess: () => refresh() });
}

export function useAddGoogleFont() {
  const refresh = useRefreshFonts();
  return useMutation({
    mutationFn: (choice: { id: string; weights: string[]; italic: boolean }) =>
      addGoogleFont(choice.id, choice.weights, choice.italic),
    onSuccess: () => refresh(),
  });
}

export function useConnectAdobeProject() {
  const refresh = useRefreshFonts();
  return useMutation({ mutationFn: connectAdobeProject, onSuccess: refresh });
}

export function useDisconnectAdobeProject() {
  const refresh = useRefreshFonts();
  return useMutation({ mutationFn: disconnectAdobeProject, onSuccess: refresh });
}

export function useRemoveSiteFont() {
  const refresh = useRefreshFonts();
  return useMutation({ mutationFn: removeSiteFont, onSuccess: () => refresh() });
}

let loadedCount = 0;

/**
 * Shows text in a font before it is on the site: loads the file and gives it a private
 * name in this page only, so previews never clash with the admin's own fonts. Undefined
 * until it has loaded (the text shows in the admin's font meanwhile), or if it can't.
 */
export function useFontPreview(url: string | undefined, withSession: boolean): string | undefined {
  const preview = useQuery({
    queryKey: ["site-fonts", "preview", url],
    enabled: url !== undefined && typeof FontFace !== "undefined",
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const bytes = await loadFontFile(url ?? "", withSession);
      loadedCount += 1;
      const name = `lintel-preview-${loadedCount}`;
      const face = new FontFace(name, bytes);
      document.fonts.add(await face.load());
      return name;
    },
  });
  return preview.data;
}
