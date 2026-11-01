import { HttpError } from "../http/http-errors.js";

export class StarterSiteNotFoundError extends HttpError {
  constructor(starterSiteId: string) {
    super(
      404,
      "NOT_FOUND",
      `There is no template called “${starterSiteId}”. Pick one from the template library.`,
    );
    this.name = "StarterSiteNotFoundError";
  }
}

/** The site has pages already, and the request didn't say what to do with them. */
export class SiteHasPagesError extends HttpError {
  constructor(pageCount: number) {
    super(
      409,
      "SITE_HAS_PAGES",
      `This site already has ${pageCount === 1 ? "a page" : `${pageCount} pages`}. Choose whether the template's pages replace them or go alongside them.`,
    );
  }
}
