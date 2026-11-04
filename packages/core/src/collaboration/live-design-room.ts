import { randomUUID } from "node:crypto";
import {
  applyPageChanges,
  diffPages,
  type LiveServerMessage,
  type PageChange,
  type PageDocument,
} from "@lintel/builder-model";
import type { SignedIn } from "../auth/auth.schema.js";
import type { Entry } from "../entries/entries.table.js";
import { hasUnpublishedChanges } from "../entries/entry-responses.js";
import { HttpError } from "../http/http-errors.js";
import type { LiveTab } from "./live-connection.js";
import type { StoredDesign, StoredResult } from "./live-design.service.js";
import { liveLimits } from "./live-limits.js";

/** What a room asks of the rest of Lintel. */
export interface RoomServices {
  check: (
    entry: Entry,
    before: PageDocument,
    after: PageDocument,
    signedIn: SignedIn,
  ) => Promise<void>;
  store: (document: PageDocument, author: SignedIn | null) => Promise<StoredResult | null>;
  read: () => Promise<StoredDesign | null>;
  onError: (error: unknown) => void;
}

type RoomMessage<Message> = Message extends LiveServerMessage
  ? Omit<Message, "tab" | "entryId" | "field">
  : never;

/**
 * One page design being edited by whoever has it open. The room holds the design and is the one
 * place that puts everyone's steps in order: each is checked against the person who sent it,
 * applied, and passed to the others, one at a time. Stored designs stay the truth; the room is
 * only the moments between stores, a second or so behind, and it stores before it closes.
 */
export class LiveDesignRoom {
  readonly session = randomUUID();
  readonly tabs = new Set<LiveTab>();
  private sequence = 0;
  private storedSequence = 0;
  private version: number;
  private hasUnpublished: boolean;
  private storedDocument: PageDocument;
  private lastAuthor: SignedIn | null = null;
  private firstUnstoredAt: number | null = null;
  private timer: NodeJS.Timeout | null = null;
  private readonly batches = new Map<string, number>();
  private work: Promise<unknown> = Promise.resolve();

  constructor(
    readonly entryId: string,
    readonly field: string,
    private entry: Entry,
    private document: PageDocument,
    private readonly services: RoomServices,
  ) {
    this.version = entry.version;
    this.storedDocument = document;
    this.hasUnpublished = hasUnpublishedChanges(entry);
  }

  /** Whether changes are waiting to be stored. */
  get isDirty(): boolean {
    return this.sequence !== this.storedSequence;
  }

  /** Lets a person's tab in, and gives it the design as it is now. */
  join(tab: LiveTab, canEdit: boolean): Promise<void> {
    return this.inTurn(async () => {
      this.tabs.add(tab);
      this.tell(tab, {
        type: "designOpened",
        session: this.session,
        sequence: this.sequence,
        version: this.version,
        document: this.document,
        canEdit,
      });
    });
  }

  leave(tab: LiveTab): void {
    this.tabs.delete(tab);
  }

  /** One person's steps: checked, applied and passed on, or refused with the reason. */
  change(tab: LiveTab, batch: string, changes: readonly PageChange[]): Promise<void> {
    return this.inTurn(async () => {
      const seen = this.batches.get(batch);
      if (seen !== undefined) {
        this.tell(tab, { type: "changesAccepted", batch, sequence: seen });
        return;
      }
      const { signedIn } = tab.connection;
      const next = applyPageChanges(this.document, changes);
      if (next !== this.document) {
        try {
          await this.services.check(this.entry, this.document, next, signedIn);
        } catch (error) {
          this.refuse(tab, batch, error);
          return;
        }
        this.commit(next, changes, signedIn, tab);
      }
      this.rememberBatch(batch);
      this.tell(tab, { type: "changesAccepted", batch, sequence: this.sequence });
      if (this.isDirty) this.storeSoon();
    });
  }

  /** Stores now, and tells `tab` when it's done. */
  store(tab: LiveTab | null = null, request?: string): Promise<void> {
    return this.inTurn(() => this.storeInTurn(tab, request));
  }

  /**
   * The entry was saved some other way (a restore, the API, someone without the connection).
   * Their changes come in on top of what's here, and everyone gets them.
   */
  takeInSave(personId: string | null): Promise<void> {
    return this.inTurn(async () => {
      const stored = await this.services.read();
      if (!stored || stored.entry.version === this.version) return;
      this.entry = stored.entry;
      this.version = stored.entry.version;
      this.hasUnpublished = hasUnpublishedChanges(stored.entry);
      const changes = diffPages(this.storedDocument, stored.document);
      this.storedDocument = stored.document;
      if (changes.length === 0) return;
      this.document = applyPageChanges(this.document, changes);
      const wasDirty = this.isDirty;
      this.sequence += 1;
      if (!wasDirty) this.storedSequence = this.sequence;
      for (const tab of this.tabs) {
        this.tell(tab, { type: "designChanged", sequence: this.sequence, personId, changes });
      }
    });
  }

  /** Stops the timer. What's waiting is the caller's to store first. */
  close(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** One thing at a time, in the order they came: this is what makes one order for everyone. */
  private inTurn<Result>(task: () => Promise<Result>): Promise<Result> {
    const result = this.work.then(task, task);
    this.work = result.catch((error: unknown) => this.services.onError(error));
    return result;
  }

  private commit(
    next: PageDocument,
    changes: readonly PageChange[],
    signedIn: SignedIn,
    from: LiveTab,
  ): void {
    this.document = next;
    this.sequence += 1;
    this.lastAuthor = signedIn;
    this.firstUnstoredAt ??= Date.now();
    const { sequence } = this;
    for (const tab of this.tabs) {
      if (tab === from) continue;
      const personId = signedIn.user.id;
      this.tell(tab, { type: "designChanged", sequence, personId, changes });
    }
  }

  private rememberBatch(batch: string): void {
    this.batches.set(batch, this.sequence);
    if (this.batches.size > liveLimits.batchesRemembered) {
      const oldest = this.batches.keys().next().value;
      if (oldest !== undefined) this.batches.delete(oldest);
    }
  }

  private refuse(tab: LiveTab, batch: string, error: unknown): void {
    if (!(error instanceof HttpError)) this.services.onError(error);
    this.tell(tab, {
      type: "changesRefused",
      batch,
      code: error instanceof HttpError ? error.code : "NOT_SAVED",
      message:
        error instanceof HttpError ? error.message : "That change couldn't be made. Try again.",
    });
  }

  private storeSoon(): void {
    if (this.timer) clearTimeout(this.timer);
    const waited = Date.now() - (this.firstUnstoredAt ?? Date.now());
    const delay = Math.min(
      liveLimits.storeAfterMilliseconds,
      Math.max(0, liveLimits.storeAtLeastEveryMilliseconds - waited),
    );
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.store().catch((error: unknown) => this.services.onError(error));
    }, delay);
    this.timer.unref();
  }

  private async storeInTurn(asking: LiveTab | null, request?: string): Promise<void> {
    if (!this.isDirty) {
      if (asking) this.tellStored(asking, this.hasUnpublished, request);
      return;
    }
    const { sequence, document } = this;
    let stored: StoredResult | null;
    try {
      stored = await this.services.store(document, this.lastAuthor);
    } catch (error) {
      if (!(error instanceof HttpError)) this.services.onError(error);
      const message = error instanceof HttpError ? error.message : "The page couldn't be saved.";
      for (const tab of this.tabs) {
        const answer = tab === asking && request !== undefined ? { request } : {};
        this.tell(tab, { type: "designNotStored", message, ...answer });
      }
      return;
    }
    if (!stored) return;
    this.storedSequence = sequence;
    this.storedDocument = document;
    this.firstUnstoredAt = null;
    this.entry = stored.entry;
    this.version = stored.entry.version;
    this.hasUnpublished = stored.hasUnpublishedChanges;
    for (const tab of this.tabs) {
      this.tellStored(tab, stored.hasUnpublishedChanges, tab === asking ? request : undefined);
    }
  }

  private tellStored(tab: LiveTab, hasUnpublishedChanges: boolean, request?: string): void {
    this.tell(tab, {
      type: "designStored",
      sequence: this.storedSequence,
      version: this.version,
      hasUnpublishedChanges,
      ...(request === undefined ? {} : { request }),
    });
  }

  private tell(tab: LiveTab, message: RoomMessage<LiveServerMessage>): void {
    tab.connection.send({
      ...message,
      tab: tab.id,
      entryId: this.entryId,
      field: this.field,
    } as LiveServerMessage);
  }
}
