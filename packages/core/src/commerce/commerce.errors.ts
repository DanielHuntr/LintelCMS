import { HttpError } from "../http/http-errors.js";

/** Every shop endpoint answers this while the "Online shop" plugin is switched off. */
export class CommercePluginDisabledError extends HttpError {
  constructor() {
    super(
      404,
      "PLUGIN_NOT_ENABLED",
      "The online shop is switched off. An admin can switch it on in Settings → Plugins.",
    );
  }
}

/** Something a shop request refers to (a product, an order...) that isn't there. */
export class ShopRecordNotFoundError extends HttpError {
  constructor(thing: string) {
    super(404, "NOT_FOUND", `That ${thing} doesn't exist. It may have been deleted.`);
  }
}

/** A request that makes sense in general but not for this shop's set-up right now. */
export class ShopNotReadyError extends HttpError {
  constructor(message: string) {
    super(409, "SHOP_NOT_READY", message);
  }
}

/** Stripe refused or couldn't be reached. The message says which, in plain words. */
export class PaymentProviderError extends HttpError {
  constructor(message: string) {
    super(502, "PAYMENT_PROVIDER_ERROR", message);
  }
}
