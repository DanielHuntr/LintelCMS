import type { PageDocument } from "../document/page-document.schema.js";
import { applyPageChanges, diffPages, type PageChange } from "./page-changes.js";

/** Some of this person's steps, sent as one message. */
export interface ChangeBatch {
  id: string;
  changes: readonly PageChange[];
}

/** The page after someone else's changes, and those changes. */
export interface RemoteUpdate {
  /** The page as this person should now see it: theirs, with this person's unsent edits on top. */
  document: PageDocument;
  /** What changed, so the builder can carry it into this person's undo history too. */
  changes: readonly PageChange[];
}

/**
 * One person's copy of a page while others edit it too. The server puts everyone's steps in one
 * order, so the page is kept in two layers:
 *
 *   - `confirmed`: the steps the server has said happened, in its order;
 *   - this person's edits it hasn't confirmed yet, re-applied on top each time.
 *
 * Everyone ends up with the same page, because everyone applies the same steps in the same
 * order to `confirmed`. The edits waiting on top are why typing never stutters.
 *
 * It knows nothing of sockets or React, and one batch is on its way at a time, so a burst of
 * changes (a slider dragged) goes as a few messages rather than hundreds.
 */
export class LiveDocument {
  private confirmed: PageDocument;
  private local: PageDocument;
  private inFlight: ChangeBatch | null = null;
  private waiting: PageChange[] = [];
  /** Confirmed, but not yet known to be stored; sent again if the server lost them. */
  private unstored: { sequence: number; changes: readonly PageChange[] }[] = [];
  private batchCount = 0;

  constructor(
    document: PageDocument,
    private readonly batchPrefix: string,
  ) {
    this.confirmed = document;
    this.local = document;
  }

  get document(): PageDocument {
    return this.local;
  }

  /** The page as the server last confirmed it, without this person's waiting edits. */
  get confirmedDocument(): PageDocument {
    return this.confirmed;
  }

  /** Whether anything of this person's has yet to reach the server. */
  get hasWaitingChanges(): boolean {
    return this.inFlight !== null || this.waiting.length > 0;
  }

  /** Whether anything of this person's isn't known to be stored yet. */
  get hasUnstoredChanges(): boolean {
    return this.hasWaitingChanges || this.unstored.length > 0;
  }

  /** This person's page changed. Says whether that made any steps to send. */
  edit(next: PageDocument): boolean {
    const changes = diffPages(this.local, next);
    this.local = next;
    if (changes.length === 0) return false;
    this.waiting.push(...changes);
    return true;
  }

  /** The next batch to send, or null while one is on its way or nothing waits. */
  nextBatch(): ChangeBatch | null {
    if (this.inFlight || this.waiting.length === 0) return null;
    this.batchCount += 1;
    this.inFlight = { id: `${this.batchPrefix}-${this.batchCount}`, changes: this.waiting };
    this.waiting = [];
    return this.inFlight;
  }

  /** The server put this person's batch in its order. */
  accepted(batchId: string, sequence: number): void {
    if (this.inFlight?.id !== batchId) return;
    const { changes } = this.inFlight;
    this.confirmed = applyPageChanges(this.confirmed, changes);
    this.unstored.push({ sequence, changes });
    this.inFlight = null;
  }

  /** The server refused this person's batch: those edits are taken back. */
  refused(batchId: string): RemoteUpdate | null {
    if (this.inFlight?.id !== batchId) return null;
    const before = this.local;
    this.inFlight = null;
    this.rebuild();
    return { document: this.local, changes: diffPages(before, this.local) };
  }

  /** Someone else's steps, in the server's order. */
  remote(changes: readonly PageChange[]): RemoteUpdate {
    this.confirmed = applyPageChanges(this.confirmed, changes);
    this.rebuild();
    return { document: this.local, changes };
  }

  /** The server stored everything up to `sequence`. */
  stored(sequence: number): void {
    this.unstored = this.unstored.filter((each) => each.sequence > sequence);
  }

  /**
   * The page as the server has it, on joining or coming back after losing the connection.
   * What was on its way goes again, after everything else that is waiting. Steps said to be
   * stored by a server that has since restarted (`isNewSession`) go again too: they are safe
   * to repeat, and it may have lost them.
   */
  rejoin(document: PageDocument, isNewSession: boolean): RemoteUpdate {
    const changes = diffPages(this.confirmed, document);
    this.confirmed = document;
    const resend = [
      ...(isNewSession ? this.unstored.flatMap((each) => each.changes) : []),
      ...(this.inFlight?.changes ?? []),
    ];
    if (isNewSession) this.unstored = [];
    this.waiting = [...resend, ...this.waiting];
    this.inFlight = null;
    this.rebuild();
    return { document: this.local, changes };
  }

  /**
   * The page was saved another way (the connection was down, and it went through the API), so
   * there is nothing left to send.
   */
  savedElsewhere(document: PageDocument): void {
    this.confirmed = document;
    this.local = document;
    this.inFlight = null;
    this.waiting = [];
    this.unstored = [];
  }

  private rebuild(): void {
    const waiting = [...(this.inFlight?.changes ?? []), ...this.waiting];
    this.local = applyPageChanges(this.confirmed, waiting);
  }
}
