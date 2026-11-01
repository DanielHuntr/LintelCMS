import { HttpError } from "../http/http-errors.js";

export class GlobalSetNotFoundError extends HttpError {
  constructor(handle: string) {
    super(404, "NOT_FOUND", `There is no global set with the handle "${handle}".`);
  }
}

export class GlobalSetHandleTakenError extends HttpError {
  constructor(handle: string) {
    super(
      409,
      "GLOBAL_SET_HANDLE_TAKEN",
      `There is already a global set with the handle "${handle}". Pick another handle.`,
    );
  }
}
