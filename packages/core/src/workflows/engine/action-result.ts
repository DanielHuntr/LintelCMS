/** What a step that did something reports, for the run log and later steps. */
export interface ActionResult {
  /** One plain sentence for the log: "Sent to 2 people". */
  summary: string;
  /** Kept as `steps.<id>` for later templates. */
  output?: unknown;
  /** Shown when someone opens the log line: the request sent, the answer. */
  detail?: Record<string, unknown>;
}

/**
 * A step that didn't work. `retryable` failures (a server that is down, a timeout) are
 * tried again with growing waits; the rest (a missing field, an address refused) fail
 * the run straight away, because trying again wouldn't help.
 */
export class ActionFailedError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ActionFailedError";
  }
}
