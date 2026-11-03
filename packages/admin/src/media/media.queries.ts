import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  type Asset,
  type AssetChanges,
  type AssetKind,
  deleteAsset,
  getAsset,
  listAssets,
  listMediaBin,
  updateAsset,
} from "./media.api.js";

/** Enough to fill a large screen with thumbnails, small enough to load quickly. */
export const ASSETS_PER_PAGE = 60;

export const mediaKeys = {
  all: ["media"] as const,
  lists: () => [...mediaKeys.all, "list"] as const,
  list: (search: string, type: AssetKind | undefined, folder?: string) =>
    [...mediaKeys.lists(), { search: search.trim(), type, folder }] as const,
  asset: (assetId: string) => [...mediaKeys.all, "asset", assetId] as const,
  bin: () => [...mediaKeys.all, "bin"] as const,
};

type AssetPages = InfiniteData<{ assets: Asset[]; total: number }, number>;

/** The library, newest first, a page at a time ("Show more" loads the next). */
export function useAssetList(search: string, type: AssetKind | undefined, folder?: string) {
  return useInfiniteQuery({
    queryKey: mediaKeys.list(search, type, folder),
    queryFn: ({ pageParam }) =>
      listAssets({ search, type, folder, page: pageParam, perPage: ASSETS_PER_PAGE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) =>
      pages.length * ASSETS_PER_PAGE < lastPage.total ? pages.length + 1 : undefined,
    // Keep showing the previous results while a new search loads, instead of flashing empty.
    placeholderData: (previous) => previous,
  });
}

export function useAsset(assetId: string | null) {
  return useQuery({
    queryKey: mediaKeys.asset(assetId ?? ""),
    queryFn: () => getAsset(assetId ?? ""),
    enabled: assetId !== null,
  });
}

/** Saves changes and puts the result straight into every cached list, so the grid updates at once. */
export function useUpdateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, changes }: { assetId: string; changes: AssetChanges }) =>
      updateAsset(assetId, changes),
    onSuccess: (asset) => {
      queryClient.setQueryData(mediaKeys.asset(asset.id), asset);
      queryClient.setQueriesData<AssetPages>({ queryKey: mediaKeys.lists() }, (data) =>
        replaceInPages(data, asset.id, (pageAssets) =>
          pageAssets.map((existing) => (existing.id === asset.id ? asset : existing)),
        ),
      );
    },
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assetId: string) => deleteAsset(assetId),
    onSuccess: (_result, assetId) => {
      queryClient.removeQueries({ queryKey: mediaKeys.asset(assetId) });
      void queryClient.invalidateQueries({ queryKey: mediaKeys.bin() });
      return queryClient.invalidateQueries({ queryKey: mediaKeys.lists() });
    },
  });
}

/** The media recycle bin, for the Recycle bin screen. Only asked for when `enabled`. */
export function useMediaBin(enabled: boolean) {
  return useQuery({ queryKey: mediaKeys.bin(), queryFn: listMediaBin, enabled });
}

/** After a file comes back or leaves the bin: show it where it now is. */
export function useRefreshMediaBin() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: mediaKeys.bin() }),
      queryClient.invalidateQueries({ queryKey: mediaKeys.lists() }),
    ]);
}

/** After an upload: show the new file in every list. */
export function useRefreshAssetLists() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: mediaKeys.lists() });
}

function replaceInPages(
  data: AssetPages | undefined,
  assetId: string,
  change: (assets: Asset[]) => Asset[],
): AssetPages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) =>
      page.assets.some((asset) => asset.id === assetId)
        ? { ...page, assets: change(page.assets) }
        : page,
    ),
  };
}
