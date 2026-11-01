import type { BoundPicture, CustomBlock, PageNode } from "@lintel/builder-model";
import { findBlockInstances, instanceValues } from "@lintel/builder-model";
import { useQueries } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { type Asset, getAsset } from "../media/media.api.js";
import { mediaKeys } from "../media/media.queries.js";

/**
 * The pictures image properties point at, by asset id, so the canvas and previews can show
 * them. Each asset is asked for once and remembered, as the media library does.
 */
export function useBlockPictures(assetIds: readonly string[]): Record<string, BoundPicture> {
  // The same ids in a new list give the same `unique`, so nothing is worked out again.
  const key = [...new Set(assetIds)].sort().join("\n");
  const unique = useMemo(() => (key === "" ? [] : key.split("\n")), [key]);
  // Kept the same between renders, so the pictures are only worked out again when an asset
  // arrives, and the canvas isn't redrawn for nothing.
  const combine = useCallback(
    (results: ReadonlyArray<{ data?: Asset }>) => {
      const pictures: Record<string, BoundPicture> = {};
      results.forEach((result, index) => {
        const asset = result.data;
        const assetId = unique[index];
        if (asset && assetId) {
          pictures[assetId] = {
            src: asset.url,
            alt: asset.alt,
            width: asset.width,
            height: asset.height,
          };
        }
      });
      return pictures;
    },
    [unique],
  );
  return useQueries({
    queries: unique.map((assetId) => ({
      queryKey: mediaKeys.asset(assetId),
      queryFn: () => getAsset(assetId),
      staleTime: 5 * 60 * 1000,
    })),
    combine,
  });
}

/** The asset ids image properties hold, in one set of values (and in lists' rows). */
export function pictureIdsInValues(
  values: Readonly<Record<string, unknown>>,
  properties: CustomBlock["properties"],
): string[] {
  return properties.flatMap((property) => {
    const value = values[property.handle];
    if (property.type === "image" && typeof value === "string") return [value];
    if (property.type === "repeater" && Array.isArray(value)) {
      const rowFields = (property.options?.fields ?? []) as CustomBlock["properties"];
      return value.flatMap((row) =>
        typeof row === "object" && row !== null && "data" in row
          ? pictureIdsInValues((row as { data: Record<string, unknown> }).data, rowFields)
          : [],
      );
    }
    return [];
  });
}

/** The asset ids every instance on a page points at. */
export function pictureIdsOnPage(root: PageNode, library: readonly CustomBlock[]): string[] {
  return findBlockInstances(root).flatMap((node) => {
    const block = library.find((candidate) => candidate.handle === node.props.block);
    return block ? pictureIdsInValues(instanceValues(node), block.properties) : [];
  });
}
