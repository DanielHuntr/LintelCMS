import { type Config, loadConfig, loadProjectEnvFile } from "../config.js";
import { productionAddresses } from "../production/production.config.js";
import { createCronSecretFile, readCronSecretFile } from "../scheduler/cron-secret.repository.js";
import { CRON_SECRET_HEADER } from "../scheduler/scheduler.routes.js";
import { lintelPaths } from "../startup.js";

/**
 * `lintel cron`: asks the running Lintel to run its scheduled jobs (publishing scheduled
 * entries, sending webhooks...). Going through the website rather than the database means
 * it works while Lintel is running, and wakes it if the host paused it.
 *
 * `lintel cron --print-line` prints a line for the host's cron screen that does the same
 * with curl, which needs no Node.js path.
 */
export async function runCronCommand(
  options: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  if (environment === process.env) loadProjectEnvFile();
  const config = loadConfig(environment);
  const request = cronRequest(config);

  if (options.includes("--print-line")) {
    process.stdout.write(describeCronLine(request));
    return 0;
  }

  try {
    const response = await fetch(request.url, {
      method: "POST",
      headers: { [CRON_SECRET_HEADER]: request.secret },
      signal: AbortSignal.timeout(120_000),
    });
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      process.stderr.write(`Lintel said no (${response.status}): ${messageOf(body)}\n`);
      return 1;
    }
    const ran = ranJobs(body);
    process.stdout.write(`Ran the scheduled jobs: ${ran.join(", ") || "none are running"}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(
      `Couldn't reach Lintel at ${request.url} (${error instanceof Error ? error.message : error}). ` +
        "Check that it is running and that PUBLIC_URL is its address.\n",
    );
    return 1;
  }
}

export interface CronRequest {
  url: string;
  secret: string;
}

export function cronRequest(config: Config): CronRequest {
  const folder = lintelPaths(config).lintelFolder;
  const secret = config.CRON_SECRET ?? readCronSecretFile(folder) ?? createCronSecretFile(folder);
  const url = `${productionAddresses(config).publicApiUrl}/system/run-scheduled-jobs`;
  return { url, secret };
}

/** Every five minutes: often enough for scheduled publishing, gentle on a shared host. */
export function cronLine(request: CronRequest): string {
  return (
    `*/5 * * * * curl -fsS -X POST -H "X-Lintel-Cron-Secret: ${request.secret}" ` +
    `${request.url} > /dev/null`
  );
}

function describeCronLine(request: CronRequest): string {
  return `Add this cron job (in cPanel: Cron Jobs, "Common settings: Once Per Five Minutes",
then paste everything after the five schedule fields as the command):

${cronLine(request)}

Keep it private: it contains the cron secret.
`;
}

function messageOf(body: unknown): string {
  if (typeof body === "object" && body !== null && "message" in body) {
    return String(body.message);
  }
  return "no explanation";
}

function ranJobs(body: unknown): string[] {
  if (typeof body === "object" && body !== null && "ran" in body && Array.isArray(body.ran)) {
    return body.ran.map(String);
  }
  return [];
}
