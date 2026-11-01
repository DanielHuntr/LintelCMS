import { HttpError } from "../http/http-errors.js";

export class RoleNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That role doesn't exist. It may have been deleted.");
  }
}
