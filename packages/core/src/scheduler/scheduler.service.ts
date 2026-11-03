import { timingSafeEqual } from "node:crypto";
import type { LintelFolder } from "../database/database-choice.js";
import { createCronSecretFile, readCronSecretFile } from "./cron-secret.repository.js";
import type { ScheduledJobList } from "./scheduled-job-list.js";
import { CronSecretInvalidError, CronSecretMissingError } from "./scheduler.errors.js";

/** CRON_SECRET when it is set, otherwise the one in the data folder, made on first use. */
export function findCronSecret(configured: string | undefined, folder: LintelFolder): string {
  return configured ?? readCronSecretFile(folder) ?? createCronSecretFile(folder);
}

/** Throws unless `given` is the secret. Compared in constant time, so timing gives nothing away. */
export function checkCronSecret(given: string | undefined, expected: string): void {
  if (given === undefined || given.trim() === "") {
    throw new CronSecretMissingError();
  }
  const givenBytes = Buffer.from(given.trim());
  const expectedBytes = Buffer.from(expected);
  if (givenBytes.length !== expectedBytes.length || !timingSafeEqual(givenBytes, expectedBytes)) {
    throw new CronSecretInvalidError();
  }
}

export interface ScheduledJobsRun {
  /** The jobs that ran, such as "scheduled-publishing". */
  ran: string[];
  startedAt: string;
  finishedAt: string;
}

export async function runScheduledJobsNow(jobs: ScheduledJobList): Promise<ScheduledJobsRun> {
  const startedAt = new Date().toISOString();
  const ran = await jobs.runAll();
  return { ran, startedAt, finishedAt: new Date().toISOString() };
}
