import { HttpError } from "../http/http-errors.js";

export class WebhookNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That webhook doesn't exist. It may have been deleted.");
  }
}

export class WebhookDeliveryNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That delivery isn't in this webhook's log.");
  }
}

/** An address on the server's own network, refused so webhooks can't be used to probe it. */
export class PrivateWebhookAddressError extends HttpError {
  constructor(host: string) {
    super(
      400,
      "PRIVATE_WEBHOOK_ADDRESS",
      `Webhooks can't be sent to ${host}, because it is a private or local address. Use a public address; for local testing, start the server with WEBHOOKS_ALLOW_PRIVATE_ADDRESSES=true.`,
    );
  }
}
