/**
 * When a failed delivery is tried again: after 1 minute, then 5, 30, 2 hours and 12 hours.
 * Six attempts in all, spread over about 15 hours, which rides out a receiver being
 * redeployed or down for the night without hammering it.
 */
const RETRY_DELAYS_MINUTES = [1, 5, 30, 120, 720];

export const MAX_DELIVERY_ATTEMPTS = RETRY_DELAYS_MINUTES.length + 1;

/** When to try again after `attemptCount` attempts, or null when it's time to give up. */
export function nextRetryAt(attemptCount: number, now: Date): Date | null {
  const delayMinutes = RETRY_DELAYS_MINUTES[attemptCount - 1];
  if (delayMinutes === undefined) {
    return null;
  }
  return new Date(now.getTime() + delayMinutes * 60_000);
}
