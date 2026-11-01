import { advanceRun } from "./run-executor.js";
import { claimDueRun, findDueRunIds } from "./workflow-runs.repository.js";
import type { WorkflowServices } from "./workflow-services.js";

export interface WorkflowEngineOptions {
  services: Omit<WorkflowServices, "runSoon">;
  /** Work on runs as soon as they start. Tests turn it off and call `runDue` themselves. */
  runStraightAway: boolean;
  onError: (error: unknown) => void;
}

/** How long one server may hold a run before another may take it over. */
const RUN_LEASE_MILLISECONDS = 5 * 60_000;
const RUNS_PER_ROUND = 25;
/** A run can start others (a child workflow, an event); a few rounds pick those up too. */
const ROUNDS_PER_CALL = 5;

/**
 * Works on due runs in the background, so the request that started one doesn't wait.
 * The scheduler also calls `runDue` every minute, for waits, retries, scheduled
 * workflows and anything started while no server was working.
 */
export class WorkflowEngine {
  readonly services: WorkflowServices;
  private running: Promise<void> | undefined;
  private runAgain = false;

  constructor(private readonly options: WorkflowEngineOptions) {
    this.services = { ...options.services, runSoon: () => this.runSoon() };
  }

  /** Claims and advances every due run. Returns the ids it worked on. */
  async runDue(now = new Date()): Promise<string[]> {
    const worked: string[] = [];
    for (let round = 0; round < ROUNDS_PER_CALL; round += 1) {
      const dueIds = await findDueRunIds(this.services.database(), now, RUNS_PER_ROUND);
      const fresh = dueIds.filter((id) => !worked.includes(id));
      if (fresh.length === 0) break;
      for (const runId of fresh) {
        const leaseUntil = new Date(now.getTime() + RUN_LEASE_MILLISECONDS);
        const run = await claimDueRun(this.services.database(), runId, now, leaseUntil);
        if (!run) continue;
        worked.push(runId);
        try {
          await advanceRun(this.services, run, now);
        } catch (error) {
          this.options.onError(error);
        }
      }
    }
    return worked;
  }

  /** Starts working in the background; if already working, goes round once more after. */
  runSoon(): void {
    if (!this.options.runStraightAway) {
      return;
    }
    if (this.running) {
      this.runAgain = true;
      return;
    }
    this.running = this.runDue()
      .then(() => undefined)
      .catch(this.options.onError)
      .finally(() => {
        this.running = undefined;
        if (this.runAgain) {
          this.runAgain = false;
          this.runSoon();
        }
      });
  }

  /** Waits for background work to finish, so the server can close cleanly. */
  async finishRunning(): Promise<void> {
    this.runAgain = false;
    await this.running;
  }
}
