import { HttpError } from "../../http/http-errors.js";

export class ProductHandleTakenError extends HttpError {
  constructor(handle: string) {
    super(409, "HANDLE_TAKEN", `Another product already uses the handle "${handle}".`, {
      fields: { handle: `Another product already uses "${handle}"` },
    });
  }
}

export class SkuTakenError extends HttpError {
  constructor(sku: string, field: string, productTitle: string) {
    super(409, "SKU_TAKEN", `The SKU "${sku}" is already used by ${productTitle}.`, {
      fields: { [field]: `Already used by ${productTitle}` },
    });
  }
}
