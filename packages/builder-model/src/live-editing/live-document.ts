import type { PageDocument } from "../document/page-document.schema.js";
import { applyPageChanges, diffPages, maxChangesInBatch, type PageChange } from "./page-changes.js";

/** How much one batch may hold. The server takes a little more, for what goes around it. */
export const maxBatchBytes = 1024 * 1024;

/** At most how many bytes this takes as a message: letters beyond ASCII take up to three. */
function bytesOf(value: unknown): number {
  const text = JSON.stringify(value);
  return text.length + (text.match(/[-￿]/g)?.length ?? 0) * 2;
}

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
  private mustResend = false;

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

  /**
   * The next batch to send, or null while one is on its way or nothing waits. A lot of waiting
   * steps go a part at a time, so no message goes over what the server takes.
   */
  nextBatch(): ChangeBatch | null {
    if (this.inFlight && this.mustResend) {
      this.mustResend = false;
      return this.inFlight;
    }
    if (this.inFlight || this.waiting.length === 0) return null;
    this.batchCount += 1;
    let size = 0;
    let count = 0;
    while (count < this.waiting.length && count < maxChangesInBatch) {
      size += bytesOf(this.waiting[count]);
      if (count > 0 && size > maxBatchBytes) break;
      count += 1;
    }
    const changes = this.waiting.slice(0, count);
    this.inFlight = { id: `${this.batchPrefix}-${this.batchCount}`, changes };
    this.waiting = this.waiting.slice(count);
    return this.inFlight;
  }

  /** Whether the batch on its way is one step too big for any message. */
  get isSendingTooMuch(): boolean {
    return this.inFlight !== null && bytesOf(this.inFlight.changes) > maxBatchBytes;
  }

  /**
   * The server put this person's batch in its order. `alreadyApplied`: it was sent twice, and
   * the page last given to this person already has it, perhaps with later changes over it, so
   * it isn't applied again. That can change what's on screen, so it comes back as an update.
   */
  accepted(batchId: string, sequence: number, alreadyApplied = false): RemoteUpdate | null {
    if (this.inFlight?.id !== batchId) return null;
    const { changes } = this.inFlight;
    if (!alreadyApplied) this.confirmed = applyPageChanges(this.confirmed, changes);
    this.unstored.push({ sequence, changes });
    this.inFlight = null;
    if (!alreadyApplied) return null;
    const before = this.local;
    this.rebuild();
    return { document: this.local, changes: diffPages(before, this.local) };
  }

  /** No answer came: the batch on its way goes again, under the same id. */
  resendInFlight(): void {
    this.mustResend = this.inFlight !== null;
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
   * What was on its way goes again first, under the same id: the server may already have it,
   * and then counts it once. A server that has since restarted (`isNewSession`) remembers no
   * ids and may have lost steps it confirmed, so those go again too: they are safe to repeat.
   */
  rejoin(document: PageDocument, isNewSession: boolean): RemoteUpdate {
    const changes = diffPages(this.confirmed, document);
    this.confirmed = document;
    if (isNewSession) {
      const resend = [
        ...this.unstored.flatMap((each) => each.changes),
        ...(this.inFlight?.changes ?? []),
      ];
      this.unstored = [];
      this.waiting = [...resend, ...this.waiting];
      this.inFlight = null;
    }
    this.mustResend = this.inFlight !== null;
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
    this.mustResend = false;
    this.waiting = [];
    this.unstored = [];
  }

  private rebuild(): void {
    const waiting = [...(this.inFlight?.changes ?? []), ...this.waiting];
    this.local = applyPageChanges(this.confirmed, waiting);
  }
}
