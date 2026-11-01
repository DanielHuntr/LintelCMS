import { HttpError } from "../http/http-errors.js";

export class BrandingImageNotFoundError extends HttpError {
  constructor(field: string) {
    super(404, "NOT_FOUND", `There is no uploaded "${field}" picture.`);
  }
}
