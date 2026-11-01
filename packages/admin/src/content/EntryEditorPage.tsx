import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { useBlueprint } from "../content-types/blueprints.queries.js";
import { classNames } from "../design/classNames.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Page } from "../design/Page.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCollection, useEntry } from "./content.queries.js";
import type { Entry } from "./content.types.js";
import { editorColumns, editorWidths } from "./editorLayout.js";
import { EntryEditor } from "./EntryEditor.js";
import { newEntryId } from "./newEntryId.js";

interface EntryEditorPageProps {
  collectionHandle: string;
  entryId: string;
  /** For a new entry: the language to write it in. Undefined is the site's main language. */
  locale?: string;
}

/**
 * Loads what the editor needs (the collection, and the entry or, for a new one, its
 * blueprint), then hands over to `EntryEditor`.
 */
export function EntryEditorPage(props: EntryEditorPageProps) {
  // Wide, so the split view can use the room; the editor keeps its own writing width.
  return (
    <Page width="wide">
      <LoadedEntryEditor {...props} />
    </Page>
  );
}

function LoadedEntryEditor({ collectionHandle, entryId, locale }: EntryEditorPageProps) {
  const navigate = useNavigate();
  const isNew = entryId === newEntryId;
  const collection = useCollection(collectionHandle);
  const entry = useEntry(isNew ? undefined : entryId);
  const blueprint = useBlueprint(isNew ? collection.data?.blueprintHandle : undefined);
  const editorKey = useEditorKey(entryId);

  const failed = [collection, entry, blueprint].find((query) => query.isError);
  if (failed) {
    return <LoadError error={failed.error} onRetry={() => void failed.refetch()} />;
  }

  const loadedBlueprint = entry.data?.blueprint ?? blueprint.data;
  if (!collection.data || !loadedBlueprint || (!isNew && !entry.data)) {
    return <EditorSkeleton />;
  }

  function handleCreated(created: Entry) {
    editorKey.adopt(created.id);
    // Swap /new for the real address without a new history step or the unsaved-changes check.
    void navigate({
      to: "/content/$collection/$entryId",
      params: { collection: collectionHandle, entryId: created.id },
      replace: true,
      ignoreBlocker: true,
    });
  }

  return (
    <EntryEditor
      key={editorKey.key}
      collection={collection.data}
      blueprint={loadedBlueprint}
      initialEntry={entry.data}
      onCreated={handleCreated}
      locale={isNew ? locale : undefined}
    />
  );
}

/**
 * The key that decides when the editor starts afresh. Opening another entry (or "New entry")
 * gives a new key. A new entry getting its id after the first save keeps the same key, so the
 * editor, the cursor and anything typed meanwhile stay exactly where they are.
 */
function useEditorKey(entryId: string) {
  const [tracked, setTracked] = useState({ entryId, adoptedId: null as string | null, key: 0 });

  // Adjusting state during render when a prop changes, as the React docs recommend.
  if (tracked.entryId !== entryId) {
    const isOwnNewEntry = tracked.entryId === newEntryId && entryId === tracked.adoptedId;
    setTracked({
      entryId,
      adoptedId: null,
      key: isOwnNewEntry ? tracked.key : tracked.key + 1,
    });
  }

  return {
    key: tracked.key,
    adopt: (createdId: string) => setTracked((current) => ({ ...current, adoptedId: createdId })),
  };
}

function EditorSkeleton() {
  return (
    <LoadingRegion label={t("editor.loading")}>
      <div
        className={classNames("mb-8 flex h-10 items-center justify-between", editorWidths.panel)}
      >
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className={classNames("grid items-start", editorWidths.panel, editorColumns.panel)}>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-8 h-4 w-24" />
          <Skeleton className="h-20" />
          <Skeleton className="mt-6 h-4 w-24" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-72 rounded-card" />
      </div>
    </LoadingRegion>
  );
}
