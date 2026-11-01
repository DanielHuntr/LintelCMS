import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { oneTimeTokensTable } from "../one-time-tokens/one-time-tokens.table.js";
import { sessionsTable } from "../sessions/sessions.table.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createPersonWithRole, tokenFromLatestEmail } from "../testing/test-people.js";
import { startTestServer } from "../testing/test-server.js";
import { signInAndGetCookies } from "../testing/test-users.js";
import { FORGOT_PASSWORD_ANSWER } from "./password-reset.routes.js";

const NEW_PASSWORD = "a completely new long password";

describe("forgotten passwords", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await createPersonWithRole(testDatabase.database, "ed@example.com", "editor", "Ed");
  });

  afterEach(() => server.close());

  function post(url: string, payload: Record<string, unknown>) {
    return server.inject({ method: "POST", url, payload });
  }

  it("answers the same for an account and for nobody, and only emails the account", async () => {
    const known = await post("/auth/forgot-password", { email: "ed@example.com" });
    const unknown = await post("/auth/forgot-password", { email: "nobody@example.com" });

    expect(known.statusCode).toBe(202);
    expect(unknown.statusCode).toBe(202);
    expect(known.json()).toEqual(unknown.json());
    expect(known.json()).toEqual({ message: FORGOT_PASSWORD_ANSWER });
    expect(server.emailOutbox!.list().map((message) => message.to)).toEqual(["ed@example.com"]);
  });

  it("stores only a hash of the link's token", async () => {
    await post("/auth/forgot-password", { email: "ed@example.com" });
    const token = tokenFromLatestEmail(server, "ed@example.com");

    const [stored] = await testDatabase.database.select().from(oneTimeTokensTable);

    expect(stored!.tokenHash).not.toContain(token);
    expect(stored!.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 60 * 1000);
    expect(stored!.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(30 * 60 * 1000);
  });

  it("resets the password once, and signs out every device", async () => {
    await signInAndGetCookies(server, "ed@example.com");
    await post("/auth/forgot-password", { email: "ed@example.com" });
    const token = tokenFromLatestEmail(server, "ed@example.com");

    expect((await post("/auth/reset-password/check", { token })).json()).toEqual({ usable: true });
    const reset = await post("/auth/reset-password", { token, newPassword: NEW_PASSWORD });

    expect(reset.statusCode).toBe(204);
    expect(await testDatabase.database.select().from(sessionsTable)).toEqual([]);
    const signIn = await post("/auth/sign-in", { email: "ed@example.com", password: NEW_PASSWORD });
    expect(signIn.statusCode).toBe(200);
    expect(server.emailOutbox!.latestTo("ed@example.com")!.subject).toBe(
      "Your Lintel password was changed",
    );

    const again = await post("/auth/reset-password", {
      token,
      newPassword: "yet another long password",
    });
    expect(again.json()).toMatchObject({ code: "RESET_LINK_INVALID" });
    expect((await post("/auth/reset-password/check", { token })).json()).toEqual({ usable: false });
  });

  it("refuses an easily guessed password without using up the link", async () => {
    await post("/auth/forgot-password", { email: "ed@example.com" });
    const token = tokenFromLatestEmail(server, "ed@example.com");

    const weak = await post("/auth/reset-password", { token, newPassword: "password123456" });

    expect(weak.statusCode).toBe(400);
    expect(weak.json().fields.password).toContain("too easy to guess");
    expect((await post("/auth/reset-password/check", { token })).json()).toEqual({ usable: true });
    const reset = await post("/auth/reset-password", { token, newPassword: NEW_PASSWORD });
    expect(reset.statusCode).toBe(204);
  });

  it("stops working after 30 minutes", async () => {
    await post("/auth/forgot-password", { email: "ed@example.com" });
    const token = tokenFromLatestEmail(server, "ed@example.com");
    await testDatabase.database
      .update(oneTimeTokensTable)
      .set({ expiresAt: new Date(Date.now() - 1000) });

    const reset = await post("/auth/reset-password", { token, newPassword: NEW_PASSWORD });

    expect(reset.statusCode).toBe(400);
  });

  it("makes every earlier link useless once one is used", async () => {
    await post("/auth/forgot-password", { email: "ed@example.com" });
    const first = tokenFromLatestEmail(server, "ed@example.com");
    await post("/auth/forgot-password", { email: "ed@example.com" });
    const second = tokenFromLatestEmail(server, "ed@example.com");

    await post("/auth/reset-password", { token: second, newPassword: NEW_PASSWORD });

    expect(
      (await post("/auth/reset-password", { token: first, newPassword: NEW_PASSWORD })).statusCode,
    ).toBe(400);
  });

  it("sends at most three links in half an hour, and limits requests per address", async () => {
    const answers = [];
    for (let attempt = 0; attempt < 6; attempt++) {
      answers.push((await post("/auth/forgot-password", { email: "ed@example.com" })).statusCode);
    }

    expect(answers).toEqual([202, 202, 202, 202, 202, 429]);
    expect(server.emailOutbox!.list()).toHaveLength(3);
  });

  it("doesn't email a deactivated account", async () => {
    const { user } = await createPersonWithRole(
      testDatabase.database,
      "olive@example.com",
      "owner",
    );
    const cookies = await signInAndGetCookies(server, "olive@example.com");
    const ed = (await server.inject({ method: "GET", url: "/users?search=ed@", cookies })).json()
      .users[0];
    expect(user.id).not.toBe(ed.id);
    await server.inject({ method: "POST", url: `/users/${ed.id}/deactivate`, cookies });

    await post("/auth/forgot-password", { email: "ed@example.com" });

    expect(server.emailOutbox!.latestTo("ed@example.com")).toBeUndefined();
  });
});
