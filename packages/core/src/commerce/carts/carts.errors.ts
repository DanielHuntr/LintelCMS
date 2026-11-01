import { HttpError } from "../../http/http-errors.js";

export class CartNotFoundError extends HttpError {
  constructor() {
    super(404, "CART_NOT_FOUND", "That cart doesn't exist. Start a new one.");
  }
}

export class CartLineNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That item isn't in the cart any more.");
  }
}

export class VariantNotForSaleError extends HttpError {
  constructor() {
    super(400, "NOT_FOR_SALE", "That item isn't for sale at the moment.");
  }
}

export class ShippingRateNotOfferedError extends HttpError {
  constructor() {
    super(
      400,
      "INVALID_REQUEST",
      "That shipping option isn't offered for this address. Choose another.",
      {
        fields: { shippingRateId: "Choose one of the shipping options offered" },
      },
    );
  }
}

/** The cart can't be paid for yet; `missing` says what to ask the shopper for. */
export class CartNotReadyError extends HttpError {
  constructor(message: string, missing: string[]) {
    super(400, "CART_NOT_READY", message, { missing });
  }
}
