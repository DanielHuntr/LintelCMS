import { HttpError } from "@lintel/core/plugin";

export class BookingNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That booking doesn't exist. It may have been cancelled.");
  }
}
