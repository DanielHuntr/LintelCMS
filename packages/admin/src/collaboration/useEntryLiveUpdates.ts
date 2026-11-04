import { useEffect, useRef } from "react";
import { getEntry } from "../content/content.api.js";
import type { Entry } from "../content/content.types.js";
import { type EntryDraft, findDraftClashes } from "../content/entryDraft.js";
import { useLiveClient } from "./useLiveClient.js";

interface EntryLiveUpdatesOptions {
  entryId: string | undefined;
  saved: EntryDraft;
  current: EntryDraft;
  /** Fields edited in the designer, which this screen doesn't hold on to. */
  pageFields: readonly string[];
  actions: {
    adopt: (latest: Entry) => void;
    noteVersion: (version: number) => void;
    currentVersion: () => number;
  };
}

/**
 * Keeps a page's Content view up to date with what others save. Their changes come straight
 * in, and this person's own edits stay. When both have changed the same field it leaves things
 * alone, and the next save asks which to keep.
 */
export function useEntryLiveUpdates(options: EntryLiveUpdatesOptions): void {
  const client = useLiveClient();
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  const { entryId } = options;

  useEffect(() => {
    if (!client || !entryId) return;
    return client.listen((message) => {
      if (message.type !== "entryChanged" || message.entryId !== entryId) return;
      const { actions, pageFields } = latest.current;
      if (message.what === "deleted" || message.personId === client.personId) return;
      if (message.version <= actions.currentVersion()) return;
      if (message.what === "saved" && message.fields.every((each) => pageFields.includes(each))) {
        actions.noteVersion(message.version);
        return;
      }
      void getEntry(entryId).then(
        (entry) => {
          const { saved, current } = latest.current;
          const isNewer = entry.version > latest.current.actions.currentVersion();
          if (isNewer && findDraftClashes(saved, current, entry).length === 0) {
            latest.current.actions.adopt(entry);
          }
        },
        () => undefined,
      );
    });
  }, [client, entryId]);
}
