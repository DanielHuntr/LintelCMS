import type { Database } from "../../database/client.js";
import type { EmailMessage, EmailProvider } from "./email-provider.js";
import { insertOutboxEmail } from "./outbox.repository.js";

/** Keeps emails in the database instead of sending them. The default while developing. */
export class OutboxEmailProvider implements EmailProvider {
  readonly name = "Outbox";
  readonly deliversEmail = false;

  constructor(private readonly database: () => Database) {}

  async send(message: EmailMessage): Promise<void> {
    await insertOutboxEmail(this.database(), message);
  }
}
