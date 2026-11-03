import { useQuery } from "@tanstack/react-query";
import { getBlock, listBlocks } from "./blocks.api.js";

export const blockKeys = {
  blocks: () => ["blocks"] as const,
  block: (handle: string) => ["blocks", handle] as const,
};

export function useBlocks() {
  return useQuery({ queryKey: blockKeys.blocks(), queryFn: listBlocks });
}

export function useBlock(handle: string) {
  return useQuery({
    queryKey: blockKeys.block(handle),
    queryFn: () => getBlock(handle),
    // The editor keeps its own copy once it's open.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
