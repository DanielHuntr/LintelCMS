import { afterEach, describe, expect, it, vi } from "vitest";
import { startRepeatingJob } from "./repeating-job.js";

describe("repeating jobs", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs straight away, then on every tick, until stopped", async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => {});
    const job = startRepeatingJob({ everyMilliseconds: 1000, run, onError: () => {} });

    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(run).toHaveBeenCalledTimes(4);

    await job.stop();
    await vi.advanceTimersByTimeAsync(3000);
    expect(run).toHaveBeenCalledTimes(4);
  });

  it("doesn't start a run while the last one is still going, and stop waits for it", async () => {
    vi.useFakeTimers();
    let finishRun = () => {};
    const run = vi.fn(() => new Promise<void>((resolve) => (finishRun = resolve)));
    const job = startRepeatingJob({ everyMilliseconds: 1000, run, onError: () => {} });

    await vi.advanceTimersByTimeAsync(5000);
    expect(run).toHaveBeenCalledTimes(1);

    let stopped = false;
    const stopping = job.stop().then(() => (stopped = true));
    await Promise.resolve();
    expect(stopped).toBe(false);
    finishRun();
    await stopping;
    expect(stopped).toBe(true);
  });

  it("reports a failed run and carries on", async () => {
    vi.useFakeTimers();
    const failure = new Error("database went away");
    const run = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined);
    const onError = vi.fn();
    const job = startRepeatingJob({ everyMilliseconds: 1000, run, onError });

    await vi.advanceTimersByTimeAsync(1000);

    expect(onError).toHaveBeenCalledWith(failure);
    expect(run).toHaveBeenCalledTimes(2);
    await job.stop();
  });
});
