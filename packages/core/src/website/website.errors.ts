import { InvalidFieldsError } from "../http/http-errors.js";

export class UnknownTemplateError extends InvalidFieldsError {
  constructor() {
    super({
      template: "That template isn't installed. Please choose one of the templates listed.",
    });
  }
}

export class LogoNotFoundError extends InvalidFieldsError {
  constructor() {
    super({
      logoAssetId: "That image isn't in the media library any more. Please choose another.",
    });
  }
}
