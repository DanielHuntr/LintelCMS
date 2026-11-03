/**
 * A small in-memory cache whose entries expire after a while, and which forgets the oldest
 * entry once it holds `maxEntries`. Enough to avoid asking another service the same thing
 * twice in a few minutes; it isn't shared between servers and doesn't survive a restart.
 */
export class TimedCache<Value> {
  private readonly entries = new Map<string, { value: Value; expiresAt: number }>();

  constructor(
    private readonly keepMilliseconds: number,
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now,
  ) {}

  read(key: string): Value | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  write(key: string, value: Value): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.keepMilliseconds });
    // A Map keeps insertion order, so the first key is the oldest.
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}
