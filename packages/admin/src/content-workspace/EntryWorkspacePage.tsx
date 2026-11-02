import { lazy, Suspense, useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { useCollection, useEntry } from "../content/content.queries.js";
import { newEntryId } from "../content/newEntryId.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { EntryWorkspace } from "./EntryWorkspace.js";
import type { WorkspaceTab } from "./workspaceTabs.js";

// The classic editor, for /content/<collection>/new links from elsewhere in the admin. It
// brings the rich text editor with it, so it loads only when someone opens one.
const EntryEditorPage = lazy(async () => ({
  default: (await import("../content/EntryEditorPage.js")).EntryEditorPage,
}));

interface EntryWorkspacePageProps {
  collectionHandle: string;
  entryId: string;
  tab: WorkspaceTab | undefined;
  isPreviewOpen: boolean;
  onTabChange: (tab: WorkspaceTab) => void;
  onPreviewChange: (isOpen: boolean) => void;
  /** For a new entry started elsewhere: the language to write it in. */
  locale?: string;
}

/**
 * Loads what an entry's workspace needs and hands over to `EntryWorkspace`. It is keyed by
 * the entry, so opening another node in the tree starts afresh (after the unsaved-changes
 * check has let it go).
 */
export function EntryWorkspacePage(props: EntryWorkspacePageProps) {
  const { collectionHandle, entryId, locale } = props;
  const isNew = entryId === newEntryId;
  // An entry first saved from /new stays in the editor it was written in: swapping to the
  // workspace mid-sentence would lose the focus, and the words typed while it saved.
  const [createdHereId, setCreatedHereId] = useState<string | null>(null);
  const isCreatedHere = entryId === createdHereId;
  if (createdHereId !== null && !isNew && !isCreatedHere) {
    // Adjusting state during render when a prop changes, as the React docs recommend.
    setCreatedHereId(null);
  }
  const collection = useCollection(collectionHandle);
  const entry = useEntry(isNew || isCreatedHere ? undefined : entryId);

  if (isNew || isCreatedHere) {
    return (
      <Suspense fallback={<WorkspaceSkeleton />}>
        <EntryEditorPage
          collectionHandle={collectionHandle}
          entryId={entryId}
          locale={locale}
          onCreated={setCreatedHereId}
        />
      </Suspense>
    );
  }

  const failed = [collection, entry].find((query) => query.isError);
  if (failed) {
    return <LoadError error={failed.error} onRetry={() => void failed.refetch()} />;
  }
  if (!collection.data || !entry.data) {
    return <WorkspaceSkeleton />;
  }
  return (
    <EntryWorkspace
      key={entryId}
      collection={collection.data}
      initialEntry={entry.data}
      tab={props.tab}
      isPreviewOpen={props.isPreviewOpen}
      onTabChange={props.onTabChange}
      onPreviewChange={props.onPreviewChange}
    />
  );
}

function WorkspaceSkeleton() {
  return (
    <LoadingRegion label={t("workspace.loading")}>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-4 h-8 w-72" />
        <Skeleton className="mt-4 h-72 w-full rounded-panel" />
      </div>
    </LoadingRegion>
  );
}
