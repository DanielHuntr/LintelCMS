import { LoadError } from "../api/LoadError.js";
import { useCollection } from "../content/content.queries.js";
import { useContentTree } from "../content-tree/ContentTreeContext.js";
import type { CollectionQuery } from "../content-tree/contentTree.types.js";
import { useTreeRoots } from "../content-tree/contentTree.queries.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { Skeleton } from "../design/Skeleton.js";
import { CollectionView } from "./CollectionView.js";

interface CollectionWorkspaceProps {
  collectionHandle: string;
  query: CollectionQuery;
  onQueryChange: (query: CollectionQuery) => void;
}

/** /content/<collection>: a collection's section opened in the workspace, as a list. */
export function CollectionWorkspace({
  collectionHandle,
  query,
  onQueryChange,
}: CollectionWorkspaceProps) {
  const { siteId } = useContentTree();
  const collection = useCollection(collectionHandle);
  const roots = useTreeRoots(siteId);
  const root = roots.data?.roots.find((candidate) => candidate.handle === collectionHandle);

  if (collection.isError) {
    return <LoadError error={collection.error} onRetry={() => void collection.refetch()} />;
  }
  if (!collection.data) return <Skeleton className="h-10 w-64" />;

  return (
    <div>
      <LargeTitle title={collection.data.name} />
      <CollectionView
        key={collectionHandle}
        place={{ collection: collectionHandle }}
        placeName={collection.data.name}
        root={root}
        query={query}
        onQueryChange={onQueryChange}
      />
    </div>
  );
}
