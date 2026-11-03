import { HttpError } from "@lintel/core/plugin";
import { PROVIDER_NAMES, type ProviderId } from "./newsletter.schema.js";

/** Named errors, with the messages people see. */

export class NewsletterKeyRejectedError extends HttpError {
  constructor(provider: ProviderId) {
    const name = PROVIDER_NAMES[provider];
    super(
      400,
      "NEWSLETTER_KEY_REJECTED",
      `That API key wasn't accepted by ${name}. Copy it again from your ${name} account.`,
    );
  }
}

export class MailchimpKeyShapeError extends HttpError {
  constructor() {
    super(
      400,
      "NEWSLETTER_KEY_REJECTED",
      "A Mailchimp API key ends with a dash and a short code, such as -us21. Copy the whole key.",
    );
  }
}

export class NewsletterKeyNeededError extends HttpError {
  constructor(provider: ProviderId) {
    super(400, "NEWSLETTER_KEY_NEEDED", `Paste your API key from ${PROVIDER_NAMES[provider]}.`);
  }
}

export class NewsletterProviderUnreachableError extends HttpError {
  constructor(provider: ProviderId) {
    super(
      502,
      "NEWSLETTER_PROVIDER_UNREACHABLE",
      `${PROVIDER_NAMES[provider]} couldn't be reached just now. Try again in a minute.`,
    );
  }
}

export class NewsletterListNotFoundError extends HttpError {
  constructor(provider: ProviderId) {
    super(
      400,
      "NEWSLETTER_LIST_NOT_FOUND",
      `That list wasn't found in your ${PROVIDER_NAMES[provider]} account. Choose one from the list.`,
    );
  }
}

export class BrevoDoubleOptInNeedsTemplateError extends HttpError {
  constructor() {
    super(
      400,
      "NEWSLETTER_BREVO_TEMPLATE_NEEDED",
      "For Brevo to send a confirmation email, add the template number and the page people see after confirming.",
    );
  }
}

/** For visitors: the sign-up form isn't connected to a service yet. */
export class NewsletterNotConnectedError extends HttpError {
  constructor() {
    super(503, "NEWSLETTER_NOT_CONNECTED", "Sign-ups aren't open yet. Please try again later.");
  }
}

/** For visitors: something they typed (or didn't tick) needs another look. */
export class SignUpNotValidError extends HttpError {
  constructor(message: string) {
    super(400, "NEWSLETTER_SIGN_UP_NOT_VALID", message);
  }
}

/** For visitors: the service turned the address down. */
export class SignUpRefusedError extends HttpError {
  constructor() {
    super(
      400,
      "NEWSLETTER_SIGN_UP_REFUSED",
      "That email address couldn't be signed up. Check it and try again.",
    );
  }
}

export class TooManySignUpsError extends HttpError {
  constructor() {
    super(429, "TOO_MANY_SIGN_UPS", "That's a lot of sign-ups at once. Please wait a minute.");
  }
}
