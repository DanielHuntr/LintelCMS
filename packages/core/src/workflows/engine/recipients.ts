import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import type { Recipients } from "../workflow-definition.schema.js";
import { listPeopleWithRole, type Person } from "../workflow-people.repository.js";
import type { RunContext } from "./run-context.js";
import { renderText } from "./templates.js";

const EMAIL_ADDRESS = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

/** The people a "role" or "actor" recipient means. Addresses aren't people, so none. */
export async function findRecipientPeople(
  database: DatabaseOrTransaction,
  recipients: Recipients,
  context: RunContext,
): Promise<Person[]> {
  if (recipients.type === "role") {
    return listPeopleWithRole(database, DEFAULT_TENANT_ID, recipients.role);
  }
  if (recipients.type === "actor") {
    const actor = readActor(context);
    return actor ? [actor] : [];
  }
  return [];
}

/** Email addresses for any kind of recipient, without duplicates or malformed ones. */
export async function findRecipientAddresses(
  database: DatabaseOrTransaction,
  recipients: Recipients,
  context: RunContext,
): Promise<string[]> {
  const addresses =
    recipients.type === "addresses"
      ? renderText(recipients.addresses, context).split(/[,;\s]+/)
      : (await findRecipientPeople(database, recipients, context)).map((person) => person.email);
  return [...new Set(addresses.map((address) => address.trim()))].filter((address) =>
    EMAIL_ADDRESS.test(address),
  );
}

export function readActor(context: RunContext): Person | undefined {
  const actor = context.actor;
  if (typeof actor !== "object" || actor === null) return undefined;
  const { id, name, email } = actor as Record<string, unknown>;
  return typeof id === "string" && typeof name === "string" && typeof email === "string"
    ? { id, name, email }
    : undefined;
}
