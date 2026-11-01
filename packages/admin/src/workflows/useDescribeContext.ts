import { useMemo } from "react";
import { useCollections } from "../content/content.queries.js";
import type { DescribeContext } from "./describeSteps.js";
import { useCatalogue, useWorkflows } from "./workflows.queries.js";

/** What step descriptions need: event labels, collection names and other workflows. */
export function useDescribeContext(): DescribeContext {
  const catalogue = useCatalogue();
  const collections = useCollections();
  const workflows = useWorkflows();
  return useMemo(
    () => ({
      events: catalogue.data?.events ?? [],
      collectionNames: Object.fromEntries(
        (collections.data ?? []).map((collection) => [collection.handle, collection.name]),
      ),
      workflows: workflows.data ?? [],
    }),
    [catalogue.data, collections.data, workflows.data],
  );
}
