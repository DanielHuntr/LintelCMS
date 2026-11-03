import {
  type CustomBlock,
  findBlockInstances,
  instanceValues,
  type PageNode,
} from "@lintel/builder-model";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { renderBlocks } from "./blocks.api.js";

/**
 * The HTML of instances whose block is a React component in code: the server draws them
 * (`POST /blocks/render`), so the canvas shows what the website will. Templates and designs
 * are drawn in the browser and need nothing from here.
 */
export function useServerBlocks(
  root: PageNode | null,
  library: readonly CustomBlock[],
): Record<string, string> | undefined {
  const instances = useMemo(() => {
    if (!root) return [];
    const drawnByServer = new Set(
      library
        .filter((block) => !block.design && block.template === null)
        .map((block) => block.handle),
    );
    return findBlockInstances(root)
      .filter((node) => drawnByServer.has(String(node.props.block)))
      .map((node) => ({
        id: node.id,
        block: String(node.props.block),
        values: instanceValues(node),
      }));
  }, [root, library]);
  const rendered = useQuery({
    queryKey: ["blocks", "render", instances],
    queryFn: () => renderBlocks(instances),
    enabled: instances.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });
  return instances.length > 0 ? rendered.data : undefined;
}
