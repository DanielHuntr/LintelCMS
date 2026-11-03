import { HttpError } from "../http/http-errors.js";

export class AddonFileNotFoundError extends HttpError {
  constructor(addonId: string) {
    super(404, "NOT_FOUND", `The add-on "${addonId}" has no admin file to load.`);
  }
}

export class AddonStillOnError extends HttpError {
  constructor(name: string) {
    super(409, "ADDON_STILL_ON", `Switch ${name} off before deleting its data.`);
  }
}

export class AddonTableNotFoundError extends HttpError {
  constructor(table: string) {
    super(404, "NOT_FOUND", `This add-on has no table called "${table}".`);
  }
}
