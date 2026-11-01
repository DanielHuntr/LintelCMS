import { HttpError } from "../../http/http-errors.js";

/**
 * A code the shopper typed can't be used: "This code has expired." The message is written
 * for the shopper, so a storefront can show it as it is, next to the code box.
 */
export class DiscountCodeError extends HttpError {
  constructor(code: string, message: string, statusCode = 400) {
    super(statusCode, "DISCOUNT_CODE_INVALID", message, {
      discountCode: code,
      fields: { discountCodes: message },
    });
  }
}

export class DiscountCodeTakenError extends HttpError {
  constructor(code: string) {
    super(409, "DISCOUNT_CODE_TAKEN", `Another discount already uses the code ${code}.`, {
      fields: { code: "Another discount already uses this code. Choose a different one." },
    });
  }
}
