/**
 * How fast something is moving (the page's scroll, a drag), in units per second, from its
 * recent positions. Old samples are forgotten, so a pause reads as standing still.
 */
export class VelocityTracker {
  private samples: Array<{ time: number; position: number }> = [];

  constructor(private readonly windowMilliseconds = 100) {}

  add(position: number, time: number): void {
    this.samples.push({ time, position });
    const cutoff = time - this.windowMilliseconds;
    while (this.samples.length > 2 && (this.samples[0]?.time ?? time) < cutoff)
      this.samples.shift();
  }

  /** Units per second; 0 with fewer than two samples or when the latest is stale. */
  velocity(now: number): number {
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    if (!first || !last || last === first || now - last.time > this.windowMilliseconds) return 0;
    const seconds = (last.time - first.time) / 1000;
    return seconds > 0 ? (last.position - first.position) / seconds : 0;
  }

  reset(): void {
    this.samples = [];
  }
}

/** A speed turned into an effect's strength from 0 to 1: `fullAt` units per second is 1. */
export function velocityStrength(velocity: number, fullAt: number): number {
  return fullAt > 0 ? Math.max(-1, Math.min(1, velocity / fullAt)) : 0;
}
