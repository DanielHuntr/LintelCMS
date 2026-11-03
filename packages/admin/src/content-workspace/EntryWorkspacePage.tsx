import { EntryEditorPage } from "../content/EntryEditorPage.js";
import type { WorkspaceTab } from "./workspaceTabs.js";

interface EntryWorkspacePageProps {
  collectionHandle: string;
  /** An entry's id, or "new" for one being written. */
  entryId: string;
  tab: WorkspaceTab | undefined;
  isPreviewOpen: boolean;
  onTabChange: (tab: WorkspaceTab) => void;
  onPreviewChange: (isOpen: boolean) => void;
  /** For a new entry started elsewhere: the language to write it in. */
  locale?: string;
}

/**
 * An entry beside the content tree. New or old, it opens in the same editor, as in
 * Statamic: creating a page and opening one from the tree look and work the same, and
 * nothing swaps over after the first save.
 */
export function EntryWorkspacePage(props: EntryWorkspacePageProps) {
  return (
    <EntryEditorPage
      collectionHandle={props.collectionHandle}
      entryId={props.entryId}
      locale={props.locale}
      tab={props.tab}
      onTabChange={props.onTabChange}
      isPreviewOpen={props.isPreviewOpen}
      onPreviewChange={props.onPreviewChange}
    />
  );
}
