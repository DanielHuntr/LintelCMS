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
