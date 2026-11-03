/**
 * Limits kept in memory, per visitor hash, on top of the per-address limit on the route: a
 * page reloaded over and over counts once every few seconds, and one visitor can't send more
 * than a few hundred events an hour. Everything is forgotten each hour, so it never grows.
 */

const WINDOW_MS = 60 * 60 * 1000;
const MOST_EVENTS_AN_HOUR = 300;
const SAME_PAGE_AGAIN_AFTER_MS = 10_000;
/** A safety net against a flood of made-up visitors filling memory. */
const MOST_VISITORS_REMEMBERED = 100_000;

export class VisitorLimiter {
  private windowStartedAt = 0;
  private readonly eventCounts = new Map<string, number>();
  private readonly lastViews = new Map<string, number>();

  allows(visitorHash: string, kind: string, path: string, now: number): boolean {
    if (now - this.windowStartedAt >= WINDOW_MS) this.startWindow(now);
    const count = this.eventCounts.get(visitorHash) ?? 0;
    if (count >= MOST_EVENTS_AN_HOUR) return false;
    if (this.eventCounts.size >= MOST_VISITORS_REMEMBERED && count === 0) return false;

    if (kind === "view") {
      const viewKey = `${visitorHash}\u0000${path}`;
      const last = this.lastViews.get(viewKey);
      if (last !== undefined && now - last < SAME_PAGE_AGAIN_AFTER_MS) return false;
      this.lastViews.set(viewKey, now);
    }
    this.eventCounts.set(visitorHash, count + 1);
    return true;
  }

  clear(): void {
    this.windowStartedAt = 0;
    this.eventCounts.clear();
    this.lastViews.clear();
  }

  private startWindow(now: number): void {
    this.windowStartedAt = now;
    this.eventCounts.clear();
    this.lastViews.clear();
  }
}
