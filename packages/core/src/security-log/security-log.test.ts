import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import { createPersonWithRole } from "../testing/test-people.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { signInAndGetCookies } from "../testing/test-users.js";
import { quoteCsvValue } from "./security-log.service.js";

describe("the security log", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let asOwner: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await createPersonWithRole(testDatabase.database, "olive@example.com", "owner");
    asOwner = requestsAs(server, await signInAndGetCookies(server, "olive@example.com"));
  });

  afterEach(() => server.close());

  it("records sign-ins, failed sign-ins and API token creation, newest first", async () => {
    await server.inject({
      method: "POST",
      url: "/auth/sign-in",
      payload: { email: "nobody@example.com", password: "guess" },
    });
    await asOwner("POST", "/api-tokens", { name: "Website", access: "read" });

    const log = await asOwner("GET", "/security-log");

    expect(log.json().total).toBe(3);
    expect(log.json().events.map((event: { kind: string }) => event.kind)).toEqual([
      "api-token-created",
      "sign-in-failed",
      "sign-in",
    ]);
    expect(log.json().events[0]).toMatchObject({
      actor: { email: "olive@example.com" },
      details: { token: "Website", access: "read" },
      ipAddress: "127.0.0.1",
    });
    expect(log.json().events[1]).toMatchObject({
      actor: { id: null, email: "nobody@example.com" },
    });
  });

  it("filters by kind and exports as CSV that is safe to open in a spreadsheet", async () => {
    await server.inject({
      method: "POST",
      url: "/auth/sign-in",
      payload: { email: "nobody@example.com", password: "guess" },
    });

    const failures = await asOwner("GET", "/security-log?kind=sign-in-failed");
    const csv = await asOwner("GET", "/security-log/export");

    expect(failures.json().events).toHaveLength(1);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.headers["content-disposition"]).toMatch(/attachment; filename="security-log-/);
    expect(csv.body.split("\r\n")[0]).toBe(
      '"time","event","by","about","ip_address","browser","details"',
    );
    expect(csv.body).toContain('"sign-in-failed","nobody@example.com"');
  });

  it("is only for people who may read it", async () => {
    await createPersonWithRole(testDatabase.database, "ed@example.com", "editor");
    const asEditor = requestsAs(server, await signInAndGetCookies(server, "ed@example.com"));

    expect((await asEditor("GET", "/security-log")).statusCode).toBe(403);
    expect((await asEditor("GET", "/security-log/export")).statusCode).toBe(403);
  });

  it("quotes values and defuses formulas", () => {
    expect(quoteCsvValue('He said "hi"')).toBe('"He said ""hi"""');
    expect(quoteCsvValue("+1")).toBe(`"'+1"`);
    expect(quoteCsvValue("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
  });
});
