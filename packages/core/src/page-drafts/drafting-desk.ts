import { randomUUID } from "node:crypto";
import { DraftingBusyError, DraftNotFoundError } from "./page-drafts.errors.js";

export type DraftState = "writing" | "done" | "failed" | "stopped";

export interface DraftJob<Result> {
  id: string;
  state: DraftState;
  /** Characters written so far, and about how many to expect, for the progress bar. */
  characters: number;
  expectedCharacters: number;
  result: Result | null;
  problem: string | null;
}

interface HeldJob<Result> extends DraftJob<Result> {
  userId: string;
  controller: AbortController;
  finishedAt: number | null;
}

/** A finished draft waits this long for the person who asked to collect it. */
const KEEP_FINISHED_MS = 10 * 60 * 1000;

export interface DraftWork<Result> {
  userId: string;
  expectedCharacters: number;
  run: (signal: AbortSignal, onProgress: (characters: number) => void) => Promise<Result>;
}

/**
 * Where drafts are written: one at a time for the whole server, because the model takes most
 * of the processor and several gigabytes of memory while it writes. Each draft has a time
 * limit and can be stopped. Drafts live only in memory and only the person who asked can see
 * one; nothing here is written to a log or the database.
 */
export class DraftingDesk<Result> {
  private readonly jobs = new Map<string, HeldJob<Result>>();

  constructor(private readonly timeLimitMs: number) {}

  get isBusy(): boolean {
    return [...this.jobs.values()].some((job) => job.state === "writing");
  }

  start(work: DraftWork<Result>): DraftJob<Result> {
    this.forgetOldJobs();
    if (this.isBusy) throw new DraftingBusyError();
    const controller = new AbortController();
    const job: HeldJob<Result> = {
      id: randomUUID(),
      state: "writing",
      characters: 0,
      expectedCharacters: work.expectedCharacters,
      result: null,
      problem: null,
      userId: work.userId,
      controller,
      finishedAt: null,
    };
    this.jobs.set(job.id, job);
    const timeLimit = setTimeout(() => controller.abort(new TimeLimitReached()), this.timeLimitMs);
    timeLimit.unref();
    work
      .run(controller.signal, (characters) => {
        job.characters = characters;
      })
      .then((result) => {
        if (controller.signal.aborted) throw controller.signal.reason;
        job.result = result;
        job.state = "done";
      })
      .catch((error: unknown) => {
        const reason = controller.signal.aborted ? controller.signal.reason : error;
        if (reason instanceof TimeLimitReached) {
          job.state = "failed";
          job.problem = reason.message;
        } else if (controller.signal.aborted) {
          job.state = "stopped";
        } else {
          job.state = "failed";
          job.problem =
            reason instanceof DraftProblem
              ? reason.message
              : "The draft didn't work out this time. Try again, perhaps with a shorter description.";
        }
      })
      .finally(() => {
        clearTimeout(timeLimit);
        job.finishedAt = Date.now();
      });
    return publicView(job);
  }

  find(jobId: string, userId: string): DraftJob<Result> {
    const job = this.jobs.get(jobId);
    if (!job || job.userId !== userId) throw new DraftNotFoundError();
    return publicView(job);
  }

  stop(jobId: string, userId: string): DraftJob<Result> {
    const job = this.jobs.get(jobId);
    if (!job || job.userId !== userId) throw new DraftNotFoundError();
    if (job.state === "writing") job.controller.abort(new Error("Stopped"));
    return publicView(job);
  }

  /** Waits for the draft being written, for tests. */
  async settled(): Promise<void> {
    while (this.isBusy) await new Promise((resolve) => setTimeout(resolve, 5));
  }

  private forgetOldJobs() {
    const now = Date.now();
    for (const [id, job] of this.jobs) {
      if (job.finishedAt !== null && now - job.finishedAt > KEEP_FINISHED_MS) this.jobs.delete(id);
    }
  }
}

/** A problem worth telling people about in its own words (not the model's failures). */
export class DraftProblem extends Error {}

class TimeLimitReached extends DraftProblem {
  constructor() {
    super("The draft took too long, so it was stopped. Try again with fewer sections.");
  }
}

function publicView<Result>(job: HeldJob<Result>): DraftJob<Result> {
  return {
    id: job.id,
    state: job.state,
    characters: job.characters,
    expectedCharacters: job.expectedCharacters,
    result: job.result,
    problem: job.problem,
  };
}
