import { lookup as lookupAddress, type LookupAddress } from "node:dns";
import { request as httpRequest, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";
import { isIP } from "node:net";
import { bareHostname, isLocalHostName, isPrivateAddress } from "./address-safety.js";

/**
 * Sends one webhook request. Plain Node HTTP rather than fetch, because it lets us check
 * the address a host name resolves to right before connecting to it (see address-safety.ts).
 * Redirects are not followed: a receiver can't bounce the request somewhere private.
 */
export interface WebhookRequest {
  url: string;
  /** POST unless given; workflows' HTTP steps choose. A GET or DELETE may send "". */
  method?: string;
  body: string;
  headers: Record<string, string>;
  /** How much of the answer to keep. Defaults to 500 characters, enough for a log. */
  keptResponseCharacters?: number;
}

export interface WebhookResponseSummary {
  status: number;
  /** The start of the response body, for the delivery log. */
  bodyStart: string;
}

export interface SenderOptions {
  /** Off unless WEBHOOKS_ALLOW_PRIVATE_ADDRESSES=true, for testing against local servers. */
  allowPrivateAddresses: boolean;
  timeoutMilliseconds?: number;
}

const DEFAULT_TIMEOUT_MILLISECONDS = 10_000;
const KEPT_RESPONSE_CHARACTERS = 500;

/** Something went wrong before a response came back; the message goes in the log. */
export class WebhookSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookSendError";
  }
}

/** Throws a WebhookSendError when the address isn't allowed, so it is checked on saving too. */
export function checkWebhookAddress(url: URL, options: SenderOptions): void {
  if (options.allowPrivateAddresses) {
    return;
  }
  const host = bareHostname(url);
  if (isLocalHostName(host) || (isIP(host) !== 0 && isPrivateAddress(host))) {
    throw new WebhookSendError(`${host} is a private or local address`);
  }
}

export async function sendWebhookRequest(
  webhook: WebhookRequest,
  options: SenderOptions,
): Promise<WebhookResponseSummary> {
  const url = new URL(webhook.url);
  checkWebhookAddress(url, options);

  const kept = webhook.keptResponseCharacters ?? KEPT_RESPONSE_CHARACTERS;
  const requestOptions: RequestOptions = {
    method: webhook.method ?? "POST",
    headers: { ...webhook.headers, "content-length": String(Buffer.byteLength(webhook.body)) },
    timeout: options.timeoutMilliseconds ?? DEFAULT_TIMEOUT_MILLISECONDS,
    lookup: options.allowPrivateAddresses ? undefined : publicOnlyLookup,
  };
  const send = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const outgoing = send(url, requestOptions, (response) => {
      let bodyStart = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        if (bodyStart.length < kept) {
          bodyStart += chunk;
        }
      });
      response.on("end", () =>
        resolve({
          status: response.statusCode ?? 0,
          bodyStart: bodyStart.slice(0, kept),
        }),
      );
      response.on("error", (error) => reject(new WebhookSendError(error.message)));
    });
    outgoing.on("timeout", () => {
      outgoing.destroy(new WebhookSendError("The receiver took too long to answer"));
    });
    outgoing.on("error", (error) =>
      reject(error instanceof WebhookSendError ? error : new WebhookSendError(error.message)),
    );
    outgoing.end(webhook.body);
  });
}

/**
 * DNS lookup that refuses private addresses. Node calls it while connecting, so the
 * address checked is the address used.
 */
export const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  lookupAddress(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
    if (error) {
      callback(error, "", 0);
      return;
    }
    const blocked = addresses.find((address) => isPrivateAddress(address.address));
    if (blocked || addresses.length === 0) {
      callback(new WebhookSendError(`${hostname} points to a private or local address`), "", 0);
      return;
    }
    if (options.all) {
      callback(null, addresses);
      return;
    }
    const [first] = addresses as [LookupAddress];
    callback(null, first.address, first.family);
  });
};
