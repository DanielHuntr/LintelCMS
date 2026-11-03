import { findNodesOfType, type PageNode, type PhotoCreditData } from "@lintel/builder-model";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { getAsset } from "../media/media.api.js";
import { mediaKeys } from "../media/media.queries.js";

/**
 * The credits of the pictures on the page that need one, by asset id, for the builder: the
 * canvas draws them under Picture elements as the website will, and the Content panel offers
 * "Show the photo credit" only for these. Each picture is read from the media library once
 * and shares its cache with the rest of the admin.
 */
export function usePhotoCredits(
  root: PageNode | null,
): Readonly<Record<string, PhotoCreditData>> | undefined {
  const assetIds = useMemo(
    () =>
      root
        ? [
            ...new Set(
              findNodesOfType(root, ["image"])
                .map((node) => node.props.assetId)
                .filter(
                  (assetId): assetId is string => typeof assetId === "string" && assetId !== "",
                ),
            ),
          ].sort()
        : [],
    [root],
  );
  const assets = useQueries({
    queries: assetIds.map((assetId) => ({
      queryKey: mediaKeys.asset(assetId),
      queryFn: () => getAsset(assetId),
      staleTime: 60_000,
    })),
  });
  const credits: Record<string, PhotoCreditData> = {};
  for (const asset of assets) {
    if (asset.data?.photoCredit) credits[asset.data.id] = asset.data.photoCredit;
  }
  const key = JSON.stringify(credits);
  // A new object only when a credit changes, so the builder doesn't redraw for nothing.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `credits`.
  return useMemo(() => (assetIds.length === 0 ? undefined : credits), [key, assetIds.length]);
}
