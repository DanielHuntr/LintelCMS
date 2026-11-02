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

/** "In the main menu" is for pages: entries of a page tree, which have addresses of their own. */
export class NotAPageError extends HttpError {
  constructor() {
    super(
      400,
      "NOT_A_PAGE",
      "Only pages can go in a menu this way. Add other links from the Menus screen.",
    );
  }
}
