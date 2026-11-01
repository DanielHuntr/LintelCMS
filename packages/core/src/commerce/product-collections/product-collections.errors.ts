import { HttpError } from "../../http/http-errors.js";

export class CollectionHandleTakenError extends HttpError {
  constructor(handle: string) {
    super(409, "HANDLE_TAKEN", `Another collection already uses the handle "${handle}".`, {
      fields: { handle: `Another collection already uses "${handle}"` },
    });
  }
}
