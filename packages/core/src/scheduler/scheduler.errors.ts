import { HttpError } from "../http/http-errors.js";

export class CronSecretMissingError extends HttpError {
  constructor() {
    super(
      401,
      "CRON_SECRET_MISSING",
      "Send the cron secret in the X-Lintel-Cron-Secret header. Run `lintel cron --print-line` " +
        "on the server to see the whole command.",
    );
  }
}

export class CronSecretInvalidError extends HttpError {
  constructor() {
    super(
      403,
      "CRON_SECRET_INVALID",
      "That cron secret isn't right. Run `lintel cron --print-line` on the server to see the " +
        "current one.",
    );
  }
}
