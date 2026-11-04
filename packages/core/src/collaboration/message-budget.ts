import { liveLimits } from "./live-limits.js";

/**
 * Counts what a connection sends, as two buckets that refill over time: one for messages,
 * one for bytes. A browser in normal use never empties either.
 */
export class MessageBudget {
  private messages: number = liveLimits.messageBurst;
  private bytes: number = liveLimits.byteBurst;
  private lastRefill: number;

  constructor(now: number = Date.now()) {
    this.lastRefill = now;
  }

  /** Whether a message of this size may be handled now. */
  spend(size: number, now: number = Date.now()): boolean {
    const seconds = Math.max(0, now - this.lastRefill) / 1000;
    this.lastRefill = now;
    this.messages = Math.min(
      liveLimits.messageBurst,
      this.messages + seconds * liveLimits.messagesPerSecond,
    );
    this.bytes = Math.min(liveLimits.byteBurst, this.bytes + seconds * liveLimits.bytesPerSecond);
    if (this.messages < 1 || this.bytes < size) return false;
    this.messages -= 1;
    this.bytes -= size;
    return true;
  }
}
