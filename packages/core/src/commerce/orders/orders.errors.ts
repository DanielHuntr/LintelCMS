import { HttpError } from "../../http/http-errors.js";

export class RefundTooLargeError extends HttpError {
  constructor(refundable: string) {
    super(
      400,
      "REFUND_TOO_LARGE",
      refundable === "nothing"
        ? "This order has already been refunded in full."
        : `At most ${refundable} can still be refunded on this order.`,
      { fields: { amount: `At most ${refundable}` } },
    );
  }
}

export class InvalidOrderLinesError extends HttpError {
  constructor(message: string) {
    super(400, "INVALID_REQUEST", message, { fields: { lines: message } });
  }
}

export class OrderCancelledError extends HttpError {
  constructor(orderName: string) {
    super(409, "ORDER_CANCELLED", `Order ${orderName} was cancelled, so it can't be changed.`);
  }
}

export class OrderAlreadyFulfilledError extends HttpError {
  constructor(orderName: string) {
    super(
      409,
      "ORDER_FULFILLED",
      `Some of order ${orderName} has already been sent, so it can't be cancelled. Refund it instead.`,
    );
  }
}

export class NothingToFulfilError extends HttpError {
  constructor(orderName: string) {
    super(409, "NOTHING_TO_FULFIL", `Everything in order ${orderName} has already been sent.`);
  }
}
