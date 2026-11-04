import { describe, expect, it, vi } from "vitest";
import type { ShopContext } from "../commerce.context.js";
import { transactionThenFollowUps } from "./payment-follow-up.js";

describe("following up a payment after its transaction", () => {
  function shopThatRetriesOnce() {
    return {
      log: { error: vi.fn() },
      database: {
        // As MySQL does after a deadlock: the first attempt is undone and the work runs again.
        transaction: async (work: (transaction: object) => Promise<unknown>) => {
          await work({});
          return work({});
        },
      },
    } as unknown as ShopContext;
  }

  it("runs only what the attempt that committed asked for", async () => {
    const sent: number[] = [];
    let attempt = 0;
    const result = await transactionThenFollowUps(
      shopThatRetriesOnce(),
      "a payment",
      async (_transaction, afterCommit) => {
        attempt += 1;
        const orderOfThisAttempt = attempt;
        afterCommit.push(async () => {
          sent.push(orderOfThisAttempt);
        });
        return orderOfThisAttempt;
      },
    );

    expect(result).toBe(2);
    expect(sent).toEqual([2]);
  });

  it("runs nothing when the transaction fails", async () => {
    const action = vi.fn();
    const shop = {
      database: { transaction: () => Promise.reject(new Error("no")) },
    } as unknown as ShopContext;
    await expect(
      transactionThenFollowUps(shop, "a payment", async (_transaction, afterCommit) => {
        afterCommit.push(action);
      }),
    ).rejects.toThrow("no");
    expect(action).not.toHaveBeenCalled();
  });
});
