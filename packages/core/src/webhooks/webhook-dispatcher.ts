import type { Database } from "../database/client.js";
import { deliverDueWebhooks } from "./webhook-deliveries.service.js";
import type { SenderOptions } from "./webhook-sender.js";

export interface WebhookDispatcherOptions {
  /** Read on every run, so it follows setup switching databases. */
  database: () => Database;
  sender: SenderOptions;
  /** Send as soon as an event is queued. Tests turn it off and send when they choose. */
  sendStraightAway: boolean;
  onError: (error: unknown) => void;
}

/**
 * Sends queued webhook deliveries without making the request that caused them wait.
 * The scheduler also calls `deliverDue` every minute, which picks up retries and anything
 * queued while no server was sending.
 */
export class WebhookDispatcher {
  private running: Promise<void> | undefined;
  private runAgain = false;

  constructor(private readonly options: WebhookDispatcherOptions) {}

  get sender(): SenderOptions {
    return this.options.sender;
  }

  async deliverDue(now = new Date()): Promise<string[]> {
    return deliverDueWebhooks(this.options.database(), this.options.sender, now);
  }

  /** Starts a send in the background; if one is already going, another follows it. */
  deliverSoon(): void {
    if (!this.options.sendStraightAway) {
      return;
    }
    if (this.running) {
      this.runAgain = true;
      return;
    }
    this.running = this.deliverDue()
      .then(() => undefined)
      .catch(this.options.onError)
      .finally(() => {
        this.running = undefined;
        if (this.runAgain) {
          this.runAgain = false;
          this.deliverSoon();
        }
      });
  }

  /** Waits for a background send to finish, so the server can close cleanly. */
  async finishSending(): Promise<void> {
    this.runAgain = false;
    await this.running;
  }
}
