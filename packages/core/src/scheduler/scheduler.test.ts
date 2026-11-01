import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lintelFolderAt } from "../database/database-choice.js";
import { useTestDatabase } from "../testing/test-database.js";
import { startTestServer } from "../testing/test-server.js";
import { startRepeatingJob } from "./repeating-job.js";
import { ScheduledJobList } from "./scheduled-job-list.js";

const SECRET = "a-long-cron-secret-for-the-tests-0123456789";

describe("POST /system/run-scheduled-jobs", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance | undefined;
  let folder: string;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-cron-"));
  });
  afterEach(async () => {
    await server?.close();
    server = undefined;
    await rm(folder, { recursive: true, force: true });
  });

  async function start(cronSecret: string | undefined) {
    server = await startTestServer(testDatabase.activeDatabase, {
      runScheduledJobs: true,
      cronSecret,
      lintelFolder: lintelFolderAt(folder),
    });
    return server;
  }

  function runJobs(app: FastifyInstance, secret?: string) {
    return app.inject({
      method: "POST",
      url: "/system/run-scheduled-jobs",
      headers: secret === undefined ? {} : { "x-lintel-cron-secret": secret },
    });
  }

  it("runs every scheduled job for a request with the secret", async () => {
    const app = await start(SECRET);

    const response = await runJobs(app, SECRET);

    expect(response.statusCode).toBe(200);
    expect(response.json().ran).toEqual(
      expect.arrayContaining(["scheduled-publishing", "webhook-deliveries", "workflows"]),
    );
  });

  it("refuses requests without the secret, or with the wrong one", async () => {
    const app = await start(SECRET);

    const missing = await runJobs(app);
    expect(missing.statusCode).toBe(401);
    expect(missing.json().code).toBe("CRON_SECRET_MISSING");
    const wrong = await runJobs(app, "a-long-cron-secret-for-the-tests-0123456780");
    expect(wrong.statusCode).toBe(403);
    expect(wrong.json().code).toBe("CRON_SECRET_INVALID");
    expect((await runJobs(app, "short")).statusCode).toBe(403);
  });

  it("makes a secret of its own in the data folder when CRON_SECRET isn't set", async () => {
    const app = await start(undefined);

    expect((await runJobs(app, "anything-at-all")).statusCode).toBe(403);
    const file = join(folder, "cron-secret.txt");
    const secret = (await readFile(file, "utf8")).trim();
    expect(secret.length).toBeGreaterThanOrEqual(40);
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect((await runJobs(app, secret)).statusCode).toBe(200);
  });

  it("limits how often it can be called", async () => {
    const app = await start(SECRET);
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 12; attempt++) {
      statuses.push((await runJobs(app, "wrong-secret-wrong-secret-wrong")).statusCode);
    }
    expect(statuses.at(-1)).toBe(429);
  });
});

describe("the scheduled job list", () => {
  it("runs each job once, waiting for a run already in progress instead of doubling it", async () => {
    let finishFirstRun = () => {};
    const run = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(() => new Promise((resolve) => (finishFirstRun = resolve)))
      .mockResolvedValue(undefined);
    const job = startRepeatingJob({ everyMilliseconds: 60_000, run, onError: () => {} });
    const list = new ScheduledJobList();
    list.add("publishing", job);

    const running = list.runAll();
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(1);
    finishFirstRun();
    expect(await running).toEqual(["publishing"]);

    await list.runAll();
    expect(run).toHaveBeenCalledTimes(2);
    await job.stop();
  });
});
