/**
 * Whether the shop's address is one a payment provider can't reach: this computer, or a
 * private network. Providers refuse such a webhook address outright ("The URL must be
 * publicly accessible"), so a local shop checks with them itself (payment-checks.service.ts).
 */
export function isLocalAddress(address: string): boolean {
  let host: string;
  try {
    host = new URL(address).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    return true;
  }
  return (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    /\.(localhost|local|test|lan|internal|home)$/.test(host) ||
    /^(127|10)\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^f[cd][0-9a-f]{2}:/.test(host)
  );
}

/** A provider's webhook does the work unless it can't reach the shop or isn't set up. */
export function needsOwnChecks(publicApiUrl: string, webhookIsSetUp: boolean): boolean {
  return isLocalAddress(publicApiUrl) || !webhookIsSetUp;
}
