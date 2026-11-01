import { HttpError } from "../http/http-errors.js";

export class NavigationNotFoundError extends HttpError {
  constructor(handle: string) {
    super(404, "NOT_FOUND", `There is no menu with the handle "${handle}".`);
  }
}

export class NavigationHandleTakenError extends HttpError {
  constructor(handle: string) {
    super(
      409,
      "NAVIGATION_HANDLE_TAKEN",
      `There is already a menu with the handle "${handle}". Pick another handle.`,
    );
  }
}
