import { HttpError } from "../http/http-errors.js";

export class SiteNotFoundError extends HttpError {
  constructor(handle: string) {
    super(404, "SITE_NOT_FOUND", `There's no site called “${handle}”.`);
  }
}

export class NoSiteForAddressError extends HttpError {
  constructor(host: string) {
    super(
      404,
      "SITE_NOT_FOUND",
      `No site answers on ${host}. Add it to a site's domains in Build → Websites and domains.`,
    );
  }
}

export class SiteHandleTakenError extends HttpError {
  constructor(handle: string) {
    super(409, "SITE_HANDLE_TAKEN", `A site already uses the handle “${handle}”. Pick another.`);
  }
}

export class SiteAddressTakenError extends HttpError {
  constructor(hostname: string, siteName: string) {
    super(
      409,
      "SITE_ADDRESS_TAKEN",
      `${siteName} already answers on ${hostname} with the same path. Give this site another domain or path.`,
    );
  }
}

export class DefaultSiteRemovalError extends HttpError {
  constructor(name: string) {
    super(409, "DEFAULT_SITE", `${name} is the main site, so it can't be deleted.`);
  }
}

export class SiteHasEntriesError extends HttpError {
  constructor(name: string, entryCount: number) {
    const entries = entryCount === 1 ? "1 entry belongs" : `${entryCount} entries belong`;
    super(
      409,
      "SITE_HAS_ENTRIES",
      `${entries} to ${name}. Delete them or copy them to another site first, so nothing is lost by accident.`,
      { entryCount },
    );
  }
}

export class SiteLocaleMissingError extends HttpError {
  constructor(siteName: string, code: string) {
    super(
      400,
      "INVALID_REQUEST",
      `${siteName} isn't written in “${code}” yet. Add the language first, then make it the main one.`,
    );
  }
}

/** Someone limited to some sites can't open a role to every site, theirs included. */
export class EverySiteDeniedError extends HttpError {
  constructor() {
    super(
      403,
      "SITE_NOT_ALLOWED",
      "Only someone who works on every site can let a role work on every site.",
    );
  }
}

export class SiteAccessDeniedError extends HttpError {
  constructor(siteName: string) {
    super(
      403,
      "SITE_NOT_ALLOWED",
      `You don't have access to ${siteName}. Ask an admin if you need it.`,
    );
  }
}

export class RoleNotFoundError extends HttpError {
  constructor(handle: string) {
    super(404, "NOT_FOUND", `There's no role called “${handle}”.`);
  }
}
