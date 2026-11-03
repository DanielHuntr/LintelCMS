import { createHash } from "node:crypto";
import {
  MailchimpKeyShapeError,
  NewsletterKeyRejectedError,
  NewsletterProviderUnreachableError,
  SignUpRefusedError,
} from "./newsletter.errors.js";
import type { NewsletterList, ProviderId, SignUpRequest } from "./newsletter.schema.js";

/**
 * Mailchimp and Brevo, called from the server only: visitors' browsers never load anything
 * from either, so there is nothing for the cookie notice to ask about. `fetch` is handed in
 * so tests can stand in for the services.
 */

export type FetchFunction = typeof fetch;

/** How the site signs someone up, as saved on the Newsletter screen. */
export interface SignUpOptions {
  listId: string;
  doubleOptIn: boolean;
  brevoTemplateId: number | null;
  brevoConfirmUrl: string;
}

export interface NewsletterProvider {
  listLists(apiKey: string): Promise<NewsletterList[]>;
  signUp(apiKey: string, person: SignUpRequest, options: SignUpOptions): Promise<void>;
}

export function newsletterProvider(provider: ProviderId, fetcher: FetchFunction) {
  return provider === "mailchimp" ? mailchimp(fetcher) : brevo(fetcher);
}

interface ServiceAnswer {
  status: number;
  body: unknown;
}

/** One call to a service, with network failures and refused keys turned into plain errors. */
async function call(
  fetcher: FetchFunction,
  provider: ProviderId,
  url: string,
  init: RequestInit,
): Promise<ServiceAnswer> {
  let response: Response;
  try {
    response = await fetcher(url, { ...init, signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new NewsletterProviderUnreachableError(provider);
  }
  if (response.status === 401 || response.status === 403) {
    throw new NewsletterKeyRejectedError(provider);
  }
  if (response.status >= 500) {
    throw new NewsletterProviderUnreachableError(provider);
  }
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: response.status, body };
}

function readLists(body: unknown): NewsletterList[] {
  if (typeof body !== "object" || body === null || !("lists" in body)) return [];
  const lists = body.lists;
  if (!Array.isArray(lists)) return [];
  return lists.flatMap((list: unknown) => {
    if (typeof list !== "object" || list === null || !("id" in list) || !("name" in list)) {
      return [];
    }
    return [{ id: String(list.id), name: String(list.name) }];
  });
}

// Mailchimp: https://mailchimp.com/developer/marketing/api/

/** "0123…-us21" → "us21": the key says which of Mailchimp's data centres the account is in. */
export function mailchimpDataCentre(apiKey: string): string {
  const match = /-([a-z]+[0-9]+)$/.exec(apiKey);
  if (!match?.[1]) throw new MailchimpKeyShapeError();
  return match[1];
}

/** Mailchimp names a list member by the MD5 of their email address in lowercase. */
export function mailchimpMemberId(email: string): string {
  return createHash("md5").update(email.toLowerCase()).digest("hex");
}

function mailchimp(fetcher: FetchFunction): NewsletterProvider {
  const request = (apiKey: string, path: string, init: RequestInit = {}) =>
    call(
      fetcher,
      "mailchimp",
      `https://${mailchimpDataCentre(apiKey)}.api.mailchimp.com/3.0${path}`,
      {
        ...init,
        headers: {
          authorization: `Basic ${Buffer.from(`lintel:${apiKey}`).toString("base64")}`,
          "content-type": "application/json",
          accept: "application/json",
        },
      },
    );

  return {
    async listLists(apiKey) {
      const answer = await request(apiKey, "/lists?count=100&fields=lists.id,lists.name");
      if (answer.status !== 200) throw new NewsletterKeyRejectedError("mailchimp");
      return readLists(answer.body);
    },
    async signUp(apiKey, person, options) {
      // Only `status_if_new`: someone already on the list keeps the status they have, so a
      // subscriber is never set back to "pending", and someone who unsubscribed stays so.
      const answer = await request(
        apiKey,
        `/lists/${encodeURIComponent(options.listId)}/members/${mailchimpMemberId(person.email)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            email_address: person.email,
            status_if_new: options.doubleOptIn ? "pending" : "subscribed",
            ...(person.firstName && { merge_fields: { FNAME: person.firstName } }),
          }),
        },
      );
      if (answer.status >= 400) throw new SignUpRefusedError();
    },
  };
}

// Brevo: https://developers.brevo.com/reference

function brevo(fetcher: FetchFunction): NewsletterProvider {
  const request = (apiKey: string, path: string, init: RequestInit = {}) =>
    call(fetcher, "brevo", `https://api.brevo.com/v3${path}`, {
      ...init,
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
    });

  return {
    async listLists(apiKey) {
      const answer = await request(apiKey, "/contacts/lists?limit=50&offset=0");
      if (answer.status !== 200) throw new NewsletterKeyRejectedError("brevo");
      return readLists(answer.body);
    },
    async signUp(apiKey, person, options) {
      const listId = Number(options.listId);
      const attributes = person.firstName ? { FIRSTNAME: person.firstName } : undefined;
      const answer =
        options.doubleOptIn && options.brevoTemplateId !== null
          ? await request(apiKey, "/contacts/doubleOptinConfirmation", {
              method: "POST",
              body: JSON.stringify({
                email: person.email,
                includeListIds: [listId],
                templateId: options.brevoTemplateId,
                redirectionUrl: options.brevoConfirmUrl,
                ...(attributes && { attributes }),
              }),
            })
          : await request(apiKey, "/contacts", {
              method: "POST",
              body: JSON.stringify({
                email: person.email,
                listIds: [listId],
                updateEnabled: true,
                ...(attributes && { attributes }),
              }),
            });
      if (answer.status >= 400) throw new SignUpRefusedError();
    },
  };
}
