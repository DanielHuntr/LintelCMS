import { expect, it } from "vitest";
import { addTestUser, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  countEventsByActorSince,
  countSecurityEventRows,
  insertSecurityEvent,
  listSecurityEventRows,
} from "./security-log.repository.js";

const tenantId = "default";

describeOnEveryDatabase("Security log", (handle) => {
  it("saves events, then filters and counts them", async () => {
    const { database } = handle;
    const { id: actorId } = await addTestUser(database);
    await insertSecurityEvent(database, { kind: "sign-in", actorId, details: { method: "code" } });
    await insertSecurityEvent(database, { kind: "sign-in-failed", actorId });

    const page = { limit: 10, offset: 0 };
    expect(await listSecurityEventRows(database, { tenantId }, page)).toHaveLength(2);
    const signIns = await listSecurityEventRows(database, { tenantId, kind: "sign-in" }, page);
    expect(signIns[0]?.details).toEqual({ method: "code" });
    expect(await countSecurityEventRows(database, { tenantId, kind: "sign-in" })).toBe(1);

    const since = new Date(Date.now() - 60_000);
    expect(await countEventsByActorSince(database, actorId, "sign-in", since)).toBe(1);
  });
});
