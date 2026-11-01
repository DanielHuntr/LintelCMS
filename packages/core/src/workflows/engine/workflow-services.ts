import type { Database } from "../../database/client.js";
import type { EmailSender } from "../../email/email-sender.js";
import type { EventBus } from "../../events/event-bus.js";
import type { AssetExists } from "../../fieldtypes/image-assets.js";
import type { SenderOptions } from "../../webhooks/webhook-sender.js";

/** What running a workflow needs from the server, passed in so tests can swap any part. */
export interface WorkflowServices {
  /** Read on every use, so it follows setup switching databases. */
  database: () => Database;
  events: EventBus;
  email: EmailSender;
  /** The webhooks' sending rules, private addresses included (see src/webhooks). */
  sender: SenderOptions;
  assetExists: AssetExists;
  /** The admin's address, for links in emails. */
  adminUrl: string;
  /** Asks for due runs to be worked on soon, such as a child workflow just started. */
  runSoon: () => void;
}
