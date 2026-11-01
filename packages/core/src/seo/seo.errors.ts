import { HttpError } from "../http/http-errors.js";

export class RedirectNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That redirect doesn't exist. It may have been deleted.");
  }
}

export class RedirectAddressTakenError extends HttpError {
  constructor(fromPath: string) {
    super(409, "REDIRECT_EXISTS", `There is already a redirect from ${fromPath}.`, {
      fields: { fromPath: `There is already a redirect from ${fromPath}` },
    });
  }
}

export class RedirectToItselfError extends HttpError {
  constructor() {
    super(400, "INVALID_REQUEST", "A redirect can't send people to the address they came from.", {
      fields: { toPath: "This is the same as the old address" },
    });
  }
}

/** Sitemaps need full addresses, so they can't be made until the site's address is known. */
export class SiteAddressMissingError extends HttpError {
  constructor() {
    super(
      404,
      "SITE_ADDRESS_MISSING",
      "The sitemap needs the website's address. Add it in Settings → Search engines.",
    );
  }
}
