import type { RepeatingJob } from "./repeating-job.js";

/**
 * Every timed job the server is running, by name, so they can all be run on request: on
 * shared hosting the app is paused when nobody visits, so its timers stop too, and a cron
 * job calls POST /system/run-scheduled-jobs instead (see scheduler.routes.ts).
 *
 * Features add their job when they start it (`server.scheduledJobs.add(...)`), so the list
 * always matches what is really running.
 */
export class ScheduledJobList {
  private readonly jobs = new Map<string, RepeatingJob>();

  add(name: string, job: RepeatingJob): void {
    this.jobs.set(name, job);
  }

  remove(name: string): void {
    this.jobs.delete(name);
  }

  names(): string[] {
    return [...this.jobs.keys()];
  }

  /**
   * Runs every job once, one after another, and says which ran. A job that fails reports
   * the failure in the log, as its timer would, and the others still run.
   */
  async runAll(): Promise<string[]> {
    const ran: string[] = [];
    for (const [name, job] of this.jobs) {
      await job.runNow();
      ran.push(name);
    }
    return ran;
  }
}
