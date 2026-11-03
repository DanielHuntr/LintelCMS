import type { FastifyInstance } from "fastify";
import type { SignedIn } from "../auth/auth.schema.js";
import { isOwner } from "../roles/roles.service.js";
import { OutboxOwnersOnlyError } from "./email.errors.js";
import type { OutboxEmailDriver } from "./outbox-email-driver.js";

/** How many of the newest emails Users → Security log → Emails sent shows. */
const MESSAGES_SHOWN = 50;

/**
 * A password reset, invitation or email confirmation link. Anyone holding one can act as the
 * person it was sent to, so it is never shown to someone else.
 */
const LINK_WITH_TOKEN = /\S*[#?&]token=[^\s"'<>]+/g;

/** What is shown in place of another person's secret link. */
export const HIDDEN_LINK = "[link hidden: only the person this was sent to can use it]";

export interface OutboxResponse {
  /** False when a real driver delivers email, so there is no outbox to show. */
  enabled: boolean;
  messages: Array<{ id: string; to: string; subject: string; text: string; sentAt: string }>;
}

/**
 * The outbox for the person reading it. Only owners may: the messages hold sign-in links.
 * Links sent to anyone else lose their secret, so reading the outbox never lets one person
 * take over another's account.
 */
export async function describeOutboxFor(
  server: FastifyInstance,
  reader: SignedIn,
): Promise<OutboxResponse> {
  if (!(await isOwner(server.database, reader.user.id))) {
    throw new OutboxOwnersOnlyError();
  }
  return describeOutbox(server.emailOutbox, reader.user.email);
}

/** The outbox newest first, with secret links kept only in emails to `readerEmail`. */
export async function describeOutbox(
  outbox: OutboxEmailDriver | null,
  readerEmail: string,
): Promise<OutboxResponse> {
  if (!outbox) {
    return { enabled: false, messages: [] };
  }
  const kept = await outbox.readFolder();
  return {
    enabled: true,
    messages: kept
      .slice(-MESSAGES_SHOWN)
      .reverse()
      .map((message) => {
        const isForReader = message.to.some((address) => isSameAddress(address, readerEmail));
        const shown = (value: string) => (isForReader ? value : hideSecretLinks(value));
        return {
          id: message.id,
          to: message.to.join(", "),
          subject: shown(message.subject),
          text: shown(message.text),
          sentAt: message.sentAt,
        };
      }),
  };
}

function hideSecretLinks(value: string): string {
  return value.replace(LINK_WITH_TOKEN, HIDDEN_LINK);
}

/** Addresses can be written as `Name <address>`; compare only the address, ignoring case. */
function isSameAddress(written: string, email: string): boolean {
  const address = /<([^>]+)>/.exec(written)?.[1] ?? written;
  return address.trim().toLowerCase() === email.trim().toLowerCase();
}
