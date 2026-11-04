import { expect, it } from "vitest";
import { describeOnEveryDatabase } from "../../testing/every-database.js";
import {
  deleteCredentials,
  findSavedCredentials,
  recordPaymentEventIfNew,
  saveCredentials,
} from "./payment-accounts.repository.js";
import { recordStripeEventIfNew } from "./stripe-events.repository.js";

const first = { clientId: "a", clientSecret: "b" } as never;
const second = { clientId: "c", clientSecret: "d" } as never;

describeOnEveryDatabase("Payment accounts", (handle) => {
  it("saves one set of keys per provider, and forgets them", async () => {
    const { database } = handle;
    await saveCredentials(database, "paypal", first);
    await saveCredentials(database, "paypal", second);
    expect(await findSavedCredentials(database, "paypal")).toEqual(second);
    await deleteCredentials(database, "paypal");
    expect(await findSavedCredentials(database, "paypal")).toBeNull();
  });

  it("handles each payment event once, even at the same moment", async () => {
    const { database } = handle;
    const event = { provider: "paypal", eventId: "e1", type: "paid" } as const;
    const results = await Promise.all([
      recordPaymentEventIfNew(database, event),
      recordPaymentEventIfNew(database, event),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("handles each Stripe event once", async () => {
    const { database } = handle;
    const event = { id: "evt_1", type: "checkout.session.completed" };
    expect(await recordStripeEventIfNew(database, event)).toBe(true);
    expect(await recordStripeEventIfNew(database, event)).toBe(false);
  });
});
