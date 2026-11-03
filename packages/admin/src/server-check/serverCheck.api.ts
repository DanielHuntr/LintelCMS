import { apiRequest } from "../api/client.js";

/** One thing Lintel needs from the server, as `GET /system/server-check` reports it. */
export interface ServerCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  askHost?: string;
}

export interface ServerCheckReport {
  verdict: "runs" | "runs-with-limits" | "blocked";
  headline: string;
  checks: ServerCheck[];
  /** Ready to paste into a message to the hosting company. */
  askHost: string[];
}

export function checkServer(): Promise<ServerCheckReport> {
  return apiRequest<ServerCheckReport>("/system/server-check");
}
