import { HttpError } from "../http/http-errors.js";

/** The email couldn't be handed to the sending service. `reason` is safe to show admins. */
export class EmailNotSentError extends Error {
  constructor(
    readonly driver: string,
    readonly reason: string,
  ) {
    super(`The email couldn't be sent through ${driver}: ${reason}`);
    this.name = "EmailNotSentError";
  }
}

/** A message that doesn't make sense as an email, such as one with no recipient. */
export class InvalidEmailError extends Error {
  constructor(problems: string) {
    super(`This email can't be sent: ${problems}`);
    this.name = "InvalidEmailError";
  }
}

/** The outbox holds other people's sign-in links, so only an owner may read it. */
export class OutboxOwnersOnlyError extends HttpError {
  constructor() {
    super(403, "OWNERS_ONLY", "Only an owner of this site can read the email outbox.");
  }
}
