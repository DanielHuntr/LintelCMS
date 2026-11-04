import { expect, it } from "vitest";
import type { Database } from "../database/client.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { insertReturning } from "../database/dialect/writes.js";
import { describeOnEveryDatabase } from "../testing/every-database.js";
import { usersTable } from "../users/users.table.js";
import { lockSetup } from "./setup.repository.js";

class SetupFailed extends Error {}

/** What happens when a second transaction asks for the lock the first one holds. */
async function stepsOfTwoSetups(database: Database): Promise<string[]> {
  const steps: string[] = [];
  let letGo = () => {};
  const mayLetGo = new Promise<void>((resolve) => {
    letGo = resolve;
  });
  let sayHeld = () => {};
  const held = new Promise<void>((resolve) => {
    sayHeld = resolve;
  });
  const first = database.transaction(async (transaction) => {
    await lockSetup(transaction);
    sayHeld();
    await mayLetGo;
    steps.push("first let go");
  });
  await held;
  const second = database.transaction(async (transaction) => {
    await lockSetup(transaction);
    steps.push("second has it");
  });
  await new Promise((resolve) => setTimeout(resolve, 200));
  steps.push("waited");
  letGo();
  await Promise.all([first, second]);
  return steps;
}

/** Setup's own shape: look for an admin, and become the first if there is none. */
function becomeFirstAdmin(database: Database, email: string): Promise<boolean> {
  return database.transaction(async (transaction) => {
    await lockSetup(transaction);
    const users = tableFor(transaction, usersTable);
    const existing = await transaction.select().from(users);
    if (existing.length > 0) return false;
    await insertReturning(transaction, users, { email, name: "Ada" });
    return true;
  });
}

describeOnEveryDatabase("Setup lock", (handle) => {
  it("makes a second setup wait until the first ends, every time", async () => {
    const expected = ["waited", "first let go", "second has it"];
    expect(await stepsOfTwoSetups(handle.database)).toEqual(expected);
    expect(await stepsOfTwoSetups(handle.database)).toEqual(expected);
  });

  it("lets go when a setup fails", async () => {
    const { database } = handle;
    await expect(
      database.transaction(async (transaction) => {
        await lockSetup(transaction);
        throw new SetupFailed();
      }),
    ).rejects.toBeInstanceOf(SetupFailed);
    expect(await becomeFirstAdmin(database, "ada@example.com")).toBe(true);
  });

  it("can be taken twice in one transaction", async () => {
    await handle.database.transaction(async (transaction) => {
      await lockSetup(transaction);
      await lockSetup(transaction);
    });
  });

  it("leaves one first admin however many press the button at once", async () => {
    const { database } = handle;
    const results = await Promise.all(
      ["ada", "grace", "joan", "mary"].map((name) =>
        becomeFirstAdmin(database, `${name}@example.com`),
      ),
    );
    expect(results.filter((won) => won)).toHaveLength(1);
    expect(await database.select().from(tableFor(database, usersTable))).toHaveLength(1);
  });
});
