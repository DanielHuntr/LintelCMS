import { HttpError } from "../http/http-errors.js";

/** "Hostnames" is only for site starts: pages at the top of a page tree. */
export class NotASiteStartError extends HttpError {
  constructor() {
    super(
      400,
      "NOT_A_SITE_START",
      "Only a page at the top of the tree can have its own domain or path. Move it to the top first.",
    );
  }
}

/** Another site start already answers on that domain and path. */
export class RootAddressTakenError extends HttpError {
  constructor(address: string, otherTitle: string) {
    super(
      409,
      "ROOT_ADDRESS_TAKEN",
      otherTitle === ""
        ? `Another top-level page already uses ${address}. Choose a different domain or path.`
        : `“${otherTitle}” already uses ${address}. Choose a different domain or path.`,
    );
  }
}
