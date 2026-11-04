import {
  LiveDocument,
  type LiveServerMessage,
  type PageDocument,
  type RemoteUpdate,
} from "@lintel/builder-model";
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "../i18n/strings.js";
import type { LiveClient } from "./LiveClient.js";
import { useLiveClient } from "./useLiveClient.js";

/** How long the connection gets to come back before saving goes through the API instead. */
const HOLD_SAVING_FOR_MS = 20_000;
/** How long a page waits for the live connection when it first opens. */
const WAIT_ON_OPENING_MS = 4000;
const SETTLE_TIMEOUT_MS = 10_000;

interface LiveDesignOptions {
  entryId: string;
  field: string;
  /** The design as opened, or null when there's nothing to edit. */
  openedDesign: PageDocument | null;
  /** Someone else's changes, or a refused change taken back, to put on screen. */
  onUpdate: (update: RemoteUpdate, hasUnstoredChanges: boolean) => void;
  /** Everything up to now is stored: `document` is the page as far as the server has it. */
  onStored: (stored: {
    version: number;
    hasUnpublishedChanges: boolean;
    document: PageDocument;
  }) => void;
  /** Something about the page changed, such as someone publishing it. */
  onNews: (news: Extract<LiveServerMessage, { type: "entryChanged" }>) => void;
  /** The server wouldn't take a change, or couldn't store the page: this says why. */
  onProblem: (message: string) => void;
}

export interface LiveDesign {
  /** Edits go to the others as they're made: the server stores the page. */
  isLive: boolean;
  /** Connected a moment ago: edits wait for it to come back, on this device, for now. */
  isReconnecting: boolean;
  /** Saving should wait: edits are in safe hands, or are about to be. */
  holdsSaving: boolean;
  /** Whether this person may change the page, as the server sees it. */
  canEdit: boolean;
  /** This person has changes that aren't stored yet. */
  hasUnstoredChanges: boolean;
  /** The page, with everyone's changes this tab knows about. */
  document: () => PageDocument | null;
  /** The page as the server last confirmed it. */
  confirmed: () => PageDocument | null;
  edit: (document: PageDocument) => void;
  /** Sends what's waiting, has the server store it, and says whether that all worked. */
  settle: () => Promise<boolean>;
  /** The page was saved through the API, so nothing is waiting any more. */
  savedElsewhere: (document: PageDocument) => void;
}

/**
 * A page's design edited live. The merging is in `LiveDocument`; this connects it to the live
 * connection. If there's no connection, nothing here gets in the way: `isLive` stays false and
 * the page saves through the API. When the connection drops part way, edits are held on this
 * device and merged on its return; if it stays away, saving goes through the API instead.
 */
export function useLiveDesign(options: LiveDesignOptions): LiveDesign {
  const client = useLiveClient();
  const { entryId, field, openedDesign } = options;
  const [live] = useState(() =>
    openedDesign ? new LiveDocument(openedDesign, client?.tab ?? "tab") : null,
  );
  const [isJoined, setIsJoined] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [isHolding, setIsHolding] = useState(client !== null);
  const [canEdit, setCanEdit] = useState(true);
  const [hasUnstoredChanges, setHasUnstoredChanges] = useState(false);
  const latestOptions = useRef(options);
  const session = useRef<string | null>(null);
  const waitingForStore = useRef(new Map<string, (stored: boolean) => void>());
  const settledCount = useRef(0);
  const isJoinedNow = useRef(false);

  useEffect(() => {
    latestOptions.current = options;
  });

  const pump = useCallback(() => {
    if (!client || !live || !isJoinedNow.current) return;
    const batch = live.nextBatch();
    if (batch && live.isSendingTooMuch) {
      // One enormous change (a huge paste) can't go this way; it would only be cut off.
      const { onUpdate, onProblem } = latestOptions.current;
      const update = live.refused(batch.id);
      if (update) onUpdate(update, live.hasUnstoredChanges);
      onProblem(t("collab.tooBig"));
    } else if (batch) {
      client.send({
        type: "changes",
        entryId,
        field,
        batch: batch.id,
        changes: batch.changes as never,
      });
    }
    setHasUnstoredChanges(live.hasUnstoredChanges);
  }, [client, live, entryId, field]);

  const join = useCallback((isIn: boolean) => {
    isJoinedNow.current = isIn;
    setIsJoined(isIn);
    if (isIn) setHasJoined(true);
  }, []);

  useEffect(() => {
    if (!client || !live) return;
    const handle = (message: LiveServerMessage) => {
      if (!("entryId" in message) || message.entryId !== entryId) return;
      if ("field" in message && message.field !== field) return;
      handleLiveMessage(message);
    };
    const handleLiveMessage = (message: LiveServerMessage) => {
      const { onUpdate, onStored, onNews, onProblem } = latestOptions.current;
      switch (message.type) {
        case "designOpened": {
          const isNewSession = session.current !== null && session.current !== message.session;
          session.current = message.session;
          const update = live.rejoin(message.document, isNewSession);
          setCanEdit(message.canEdit);
          join(true);
          setIsHolding(true);
          if (update.changes.length > 0 || live.hasWaitingChanges) {
            onUpdate(update, live.hasUnstoredChanges);
          }
          pump();
          return;
        }
        case "designChanged":
          onUpdate(live.remote(message.changes), live.hasUnstoredChanges);
          return;
        case "changesAccepted":
          live.accepted(message.batch, message.sequence);
          pump();
          return;
        case "changesRefused": {
          const update = live.refused(message.batch);
          if (update) onUpdate(update, live.hasUnstoredChanges);
          onProblem(message.message);
          pump();
          return;
        }
        case "designStored":
          live.stored(message.sequence);
          setHasUnstoredChanges(live.hasUnstoredChanges);
          onStored({ ...message, document: live.confirmedDocument });
          if (message.request) answerStore(message.request, true);
          return;
        case "designNotStored":
          onProblem(message.message);
          if (message.request) answerStore(message.request, false);
          return;
        case "entryChanged":
          onNews(message);
          return;
        case "refused":
          // This design can't be edited live: it saves as pages always have.
          join(false);
          setIsHolding(false);
          return;
        default:
      }
    };
    const answerStore = (request: string, stored: boolean) => {
      waitingForStore.current.get(request)?.(stored);
      waitingForStore.current.delete(request);
    };
    const stopListening = client.listen(handle);
    const key = `design:${entryId}:${field}`;
    client.keep(key, { type: "openDesign", entryId, field });
    return () => {
      stopListening();
      client.forget(key, { type: "closeDesign", entryId, field });
    };
  }, [client, live, entryId, field, join, pump]);

  // The connection dropping: edits wait for it for a while, then saving goes the other way.
  useEffect(() => {
    if (!client) return;
    let timer = 0;
    let wasOnline = client.status === "online";
    const check = () => {
      const isOnline = client.status === "online";
      if (isOnline === wasOnline) return;
      wasOnline = isOnline;
      window.clearTimeout(timer);
      if (!isOnline) {
        join(false);
        timer = window.setTimeout(() => setIsHolding(false), HOLD_SAVING_FOR_MS);
      }
    };
    const stop = client.subscribe(check);
    // A browser that can't connect, or a server that doesn't answer, holds nothing back for long.
    const opening = window.setTimeout(() => {
      if (!isJoinedNow.current) setIsHolding(false);
    }, WAIT_ON_OPENING_MS);
    return () => {
      stop();
      window.clearTimeout(timer);
      window.clearTimeout(opening);
    };
  }, [client, join]);

  const edit = useCallback(
    (document: PageDocument) => {
      if (!live) return;
      // Saving mustn't depend on this: a page that can't be compared still saves through the API.
      try {
        live.edit(document);
      } catch {
        return;
      }
      setHasUnstoredChanges(live.hasUnstoredChanges);
      pump();
    },
    [live, pump],
  );

  const settle = useCallback(async () => {
    if (!client || !live || !isJoinedNow.current) return false;
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    while (live.hasWaitingChanges) {
      if (Date.now() > deadline || !isJoinedNow.current) return false;
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    settledCount.current += 1;
    const request = `${client.tab}-settle-${settledCount.current}`;
    return askToStore(client, entryId, field, request, waitingForStore.current);
  }, [client, live, entryId, field]);

  const savedElsewhere = useCallback(
    (document: PageDocument) => {
      live?.savedElsewhere(document);
      setHasUnstoredChanges(false);
    },
    [live],
  );

  const document = useCallback(() => live?.document ?? null, [live]);
  const confirmed = useCallback(() => live?.confirmedDocument ?? null, [live]);

  return {
    isLive: isJoined,
    isReconnecting: !isJoined && isHolding && hasJoined,
    holdsSaving: isJoined || isHolding,
    canEdit,
    hasUnstoredChanges,
    document,
    confirmed,
    edit,
    settle,
    savedElsewhere,
  };
}

function askToStore(
  client: LiveClient,
  entryId: string,
  field: string,
  request: string,
  waiting: Map<string, (stored: boolean) => void>,
): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      waiting.delete(request);
      resolve(false);
    }, SETTLE_TIMEOUT_MS);
    waiting.set(request, (stored) => {
      window.clearTimeout(timer);
      resolve(stored);
    });
    client.send({ type: "storeDesign", entryId, field, request });
  });
}
