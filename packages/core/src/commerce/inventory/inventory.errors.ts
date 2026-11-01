import { HttpError } from "../../http/http-errors.js";

/** Not enough stock for what was asked. `available` tells the storefront what's left. */
export class OutOfStockError extends HttpError {
  constructor(variantId: string, title: string, available: number) {
    super(
      409,
      "OUT_OF_STOCK",
      available > 0
        ? `Only ${available} of ${title} ${available === 1 ? "is" : "are"} left.`
        : `${title} is out of stock.`,
      { variantId, available },
    );
  }
}

export class LastLocationError extends HttpError {
  constructor() {
    super(
      400,
      "LAST_LOCATION",
      "The shop needs at least one place to keep stock, so this location can't be deleted.",
    );
  }
}
