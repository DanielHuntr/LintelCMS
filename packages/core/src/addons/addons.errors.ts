import { HttpError } from "../http/http-errors.js";

export class AddonFileNotFoundError extends HttpError {
  constructor(addonId: string) {
    super(404, "NOT_FOUND", `The add-on "${addonId}" has no admin file to load.`);
  }
}
