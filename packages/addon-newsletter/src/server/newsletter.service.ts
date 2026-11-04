import { DEFAULT_TENANT_ID, type DatabaseOrTransaction } from "@lintel/core/plugin";
import {
  BrevoDoubleOptInNeedsTemplateError,
  NewsletterKeyNeededError,
  NewsletterListNotFoundError,
  NewsletterNotConnectedError,
  SignUpNotValidError,
} from "./newsletter.errors.js";
import { type FetchFunction, newsletterProvider } from "./newsletter-providers.js";
import {
  deleteConnectionRow,
  findConnectionRow,
  saveConnectionRow,
} from "./newsletter.repository.js";
import {
  type ConnectionInput,
  type ConnectionSummary,
  type ListsRequest,
  type NewsletterList,
  type ProviderId,
  PROVIDERS,
  type SignUpRequest,
} from "./newsletter.schema.js";
import type { NewsletterConnectionRow } from "./newsletter.table.js";

/** The rules: connecting a service, and signing people up through it. */

export async function readConnection(database: DatabaseOrTransaction): Promise<ConnectionSummary> {
  const row = await findConnectionRow(database, DEFAULT_TENANT_ID);
  return row ? summarise(row) : { connected: false };
}

/** The lists in the account, with the key just typed or the one saved for that service. */
export async function listProviderLists(
  database: DatabaseOrTransaction,
  fetcher: FetchFunction,
  request: ListsRequest,
): Promise<NewsletterList[]> {
  const apiKey = await keyFor(database, request.provider, request.apiKey);
  return newsletterProvider(request.provider, fetcher).listLists(apiKey);
}

/**
 * Saves the connection after trying the key: the list must be one the service lists for it,
 * so a typo shows now rather than when the first visitor signs up.
 */
export async function saveConnection(
  database: DatabaseOrTransaction,
  fetcher: FetchFunction,
  input: ConnectionInput,
): Promise<ConnectionSummary> {
  if (input.provider === "brevo" && input.doubleOptIn) {
    if (input.brevoTemplateId === null || input.brevoConfirmUrl === "") {
      throw new BrevoDoubleOptInNeedsTemplateError();
    }
  }
  const apiKey = await keyFor(database, input.provider, input.apiKey);
  const lists = await newsletterProvider(input.provider, fetcher).listLists(apiKey);
  const list = lists.find((candidate) => candidate.id === input.listId);
  if (!list) throw new NewsletterListNotFoundError(input.provider);
  const row = await saveConnectionRow(database, {
    tenantId: DEFAULT_TENANT_ID,
    provider: input.provider,
    apiKey,
    listId: list.id,
    listName: list.name,
    doubleOptIn: input.doubleOptIn,
    brevoTemplateId: input.provider === "brevo" ? input.brevoTemplateId : null,
    brevoConfirmUrl: input.provider === "brevo" ? input.brevoConfirmUrl : "",
  });
  return summarise(row);
}

export async function disconnect(database: DatabaseOrTransaction): Promise<void> {
  await deleteConnectionRow(database, DEFAULT_TENANT_ID);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What a visitor sent, checked, with a message they can act on when it isn't right. */
export function readSignUp(body: unknown): { person: SignUpRequest; isRobot: boolean } {
  const values = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const email = typeof values.email === "string" ? values.email.trim() : "";
  const firstName = typeof values.name === "string" ? values.name.trim().slice(0, 100) : "";
  const isRobot = typeof values.website === "string" && values.website.trim() !== "";
  if (isRobot) return { person: { email, firstName }, isRobot };
  if (!email) throw new SignUpNotValidError("Please type your email address.");
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new SignUpNotValidError("That email address doesn't look right. Check it and try again.");
  }
  if (!isTicked(values.consent)) {
    throw new SignUpNotValidError("Please tick the box to say you'd like the newsletter.");
  }
  return { person: { email, firstName }, isRobot };
}

function isTicked(value: unknown): boolean {
  return value === true || value === "on" || value === "true" || value === "yes";
}

/** Signs someone up and says what happens next, in words for the visitor. */
export async function signUp(
  database: DatabaseOrTransaction,
  fetcher: FetchFunction,
  person: SignUpRequest,
): Promise<{ message: string }> {
  const row = await findConnectionRow(database, DEFAULT_TENANT_ID);
  if (!row || !isProvider(row.provider)) throw new NewsletterNotConnectedError();
  await newsletterProvider(row.provider, fetcher).signUp(row.apiKey, person, {
    listId: row.listId,
    doubleOptIn: row.doubleOptIn,
    brevoTemplateId: row.brevoTemplateId,
    brevoConfirmUrl: row.brevoConfirmUrl,
  });
  return { message: signedUpMessage(confirmsByEmail(row)) };
}

/**
 * Whether people need to tick a box to join from a form of the site's own: they do unless
 * they'll confirm by email. Without a connection nobody is added, so nothing needs asking.
 */
export async function needsConsentTick(database: DatabaseOrTransaction): Promise<boolean> {
  const row = await findConnectionRow(database, DEFAULT_TENANT_ID);
  return row !== undefined && !confirmsByEmail(row);
}

/** Whether people get an email to confirm before they're on the list. */
function confirmsByEmail(row: NewsletterConnectionRow): boolean {
  return row.doubleOptIn && (row.provider === "mailchimp" || row.brevoTemplateId !== null);
}

export function signedUpMessage(confirmsByEmail: boolean): string {
  return confirmsByEmail
    ? "Nearly there. Check your inbox and confirm your email address."
    : "Thanks, you're signed up.";
}

async function keyFor(
  database: DatabaseOrTransaction,
  provider: ProviderId,
  typed: string | undefined,
): Promise<string> {
  if (typed) return typed;
  const saved = await findConnectionRow(database, DEFAULT_TENANT_ID);
  if (saved && saved.provider === provider) return saved.apiKey;
  throw new NewsletterKeyNeededError(provider);
}

function isProvider(value: string): value is ProviderId {
  return (PROVIDERS as readonly string[]).includes(value);
}

function summarise(row: NewsletterConnectionRow): ConnectionSummary {
  if (!isProvider(row.provider)) return { connected: false };
  return {
    connected: true,
    provider: row.provider,
    keyHint: `…${row.apiKey.slice(-4)}`,
    listId: row.listId,
    listName: row.listName,
    doubleOptIn: row.doubleOptIn,
    brevoTemplateId: row.brevoTemplateId,
    brevoConfirmUrl: row.brevoConfirmUrl,
  };
}
