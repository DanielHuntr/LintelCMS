/**
 * When a failed step is tried again: after 30 seconds, then 2 minutes, 10 minutes and an
 * hour. Five attempts in all, which rides out a deploy or a short outage without
 * hammering the receiver, and gives up the same day so someone can look.
 */
const RETRY_DELAYS_SECONDS = [30, 120, 600, 3600];

export const MAXIMUM_STEP_ATTEMPTS = RETRY_DELAYS_SECONDS.length + 1;

/** How long to wait after `attempt` failed attempts, or null when it's time to give up. */
export function retryDelayMilliseconds(attempt: number): number | null {
  const seconds = RETRY_DELAYS_SECONDS[attempt - 1];
  return seconds === undefined ? null : seconds * 1000;
}
