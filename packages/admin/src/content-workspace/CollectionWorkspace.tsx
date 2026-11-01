import { ListTree, Plus } from "lucide-react";
import { LoadError } from "../api/LoadError.js";
import { useCollection } from "../content/content.queries.js";
import { useContentTree } from "../content-tree/ContentTreeContext.js";
import type { CollectionQuery, TreeRoot } from "../content-tree/contentTree.types.js";
import { useTreeRoots } from "../content-tree/contentTree.queries.js";
import { Button } from "../design/Button.js";
import { EmptyState } from "../design/EmptyState.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { CollectionView } from "./CollectionView.js";
import { type FolderView, useFolderView } from "./folderView.js";

interface CollectionWorkspaceProps {
  collectionHandle: string;
  query: CollectionQuery;
  onQueryChange: (query: CollectionQuery) => void;
}

/**
 * /content/<collection>: a collection's section opened in the workspace. A page tree can be
 * shown as the tree (the pages are on the left) or as a list of every page, to search,
 * filter and act on many at once; the choice is remembered. Other collections are a list.
 */
export function CollectionWorkspace({
  collectionHandle,
  query,
  onQueryChange,
}: CollectionWorkspaceProps) {
  const { siteId } = useContentTree();
  const collection = useCollection(collectionHandle);
  const roots = useTreeRoots(siteId);
  const root = roots.data?.roots.find((candidate) => candidate.handle === collectionHandle);
  const [view, setView] = useFolderView(collectionHandle);

  if (collection.isError) {
    return <LoadError error={collection.error} onRetry={() => void collection.refetch()} />;
  }
  if (!collection.data) return <Skeleton className="h-10 w-64" />;
  const isTree = collection.data.structure === "tree" && !root?.childrenAsCollection;

  return (
    <div>
      <LargeTitle
        title={collection.data.name}
        actions={
          isTree && (
            <SegmentedControl<FolderView>
              label={t("folderView.label")}
              options={[
                { value: "tree", label: t("folderView.tree") },
                { value: "list", label: t("folderView.list") },
              ]}
              value={view}
              onChange={setView}
            />
          )
        }
      />
      {isTree && view === "tree" ? (
        <TreeOverview name={collection.data.name} root={root} onShowList={() => setView("list")} />
      ) : (
        <CollectionView
          key={collectionHandle}
          place={{ collection: collectionHandle }}
          placeName={collection.data.name}
          root={root}
          query={query}
          onQueryChange={onQueryChange}
          allLevels={isTree}
        />
      )}
    </div>
  );
}

/** "Tree": the pages are in the tree beside the workspace; this says so, calmly. */
function TreeOverview({
  name,
  root,
  onShowList,
}: {
  name: string;
  root: TreeRoot | undefined;
  onShowList: () => void;
}) {
  const tree = useContentTree();
  const canCreate = useCan("entries:create");
  return (
    <div className="rounded-card bg-surface">
      <EmptyState
        size="page"
        icon={ListTree}
        title={t("folderView.treeTitle", { name })}
        description={t("folderView.treeDescription")}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="tinted" onClick={onShowList}>
              {t("folderView.showList")}
            </Button>
            {canCreate && root && (
              <Button
                icon={<Plus aria-hidden="true" />}
                onClick={() => tree.runAction("create", { kind: "root", root })}
              >
                {t("collectionView.create")}
              </Button>
            )}
          </div>
        }
      />
    </div>
  );
}
