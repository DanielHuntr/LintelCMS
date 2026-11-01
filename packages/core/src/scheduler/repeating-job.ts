/**
 * Runs a task straight away and then every so often, inside the server process. It is
 * the simplest thing that works for one server; with several, each runs the task, so
 * tasks must be safe to run twice (publishDueEntries is). A job queue can replace this
 * later without touching the tasks themselves.
 */
export interface RepeatingJob {
  /** Stops the timer and waits for a run in progress to finish. */
  stop(): Promise<void>;
}

export interface RepeatingJobOptions {
  everyMilliseconds: number;
  run: () => Promise<void>;
  /** A failed run is reported here; the next one still happens on time. */
  onError: (error: unknown) => void;
}

export function startRepeatingJob(options: RepeatingJobOptions): RepeatingJob {
  let running: Promise<void> | undefined;
  let stopped = false;

  const runOnce = () => {
    // A slow run (a big batch, a busy database) is left to finish rather than doubled up.
    if (running || stopped) {
      return;
    }
    running = options
      .run()
      .catch(options.onError)
      .finally(() => {
        running = undefined;
      });
  };

  const timer = setInterval(runOnce, options.everyMilliseconds);
  // The timer alone shouldn't keep a script or test process alive.
  timer.unref();
  runOnce();

  return {
    async stop() {
      stopped = true;
      clearInterval(timer);
      await running;
    },
  };
}
