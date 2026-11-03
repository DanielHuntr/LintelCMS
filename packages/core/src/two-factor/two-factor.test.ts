import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SESSION_COOKIE_NAME } from "../auth/session-cookie.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createPersonWithRole } from "../testing/test-people.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { signInAndGetCookies, TEST_PASSWORD } from "../testing/test-users.js";
import { totpCodeForStep, totpStepAt } from "./totp.js";
import { twoFactorTable } from "./two-factor.table.js";

describe("two-factor authentication", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let asEd: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await createPersonWithRole(testDatabase.database, "olive@example.com", "owner");
    await createPersonWithRole(testDatabase.database, "ed@example.com", "editor");
    asEd = requestsAs(server, await signInAndGetCookies(server, "ed@example.com"));
  });

  afterEach(() => server.close());

  /** A code from the app, `stepsAhead` 30-second windows from now. */
  function codeFor(secret: string, stepsAhead = 0): string {
    return totpCodeForStep(secret, totpStepAt(new Date()) + stepsAhead);
  }

  async function turnOn(api: SendRequest): Promise<{ secret: string; recoveryCodes: string[] }> {
    const setup = (await api("POST", "/account/two-factor/setup")).json();
    const confirmed = await api("POST", "/account/two-factor/confirm", {
      code: codeFor(setup.secret),
    });
    expect(confirmed.statusCode).toBe(200);
    return { secret: setup.secret, recoveryCodes: confirmed.json().recoveryCodes };
  }

  function signIn(email: string) {
    return server.inject({
      method: "POST",
      url: "/auth/sign-in",
      payload: { email, password: TEST_PASSWORD },
    });
  }

  function secondStep(payload: Record<string, string>) {
    return server.inject({ method: "POST", url: "/auth/sign-in/two-factor", payload });
  }

  it("is set up with a QR code and turned on only once a code from the app matches", async () => {
    const setup = await asEd("POST", "/account/two-factor/setup");

    expect(setup.headers["cache-control"]).toBe("no-store");
    expect(setup.json().qrCodeSvg).toContain("<svg");
    expect(setup.json().otpauthUrl).toContain("ed%40example.com");
    expect((await asEd("GET", "/account/two-factor")).json()).toEqual({
      enabled: false,
      required: false,
      recoveryCodesLeft: 0,
    });

    const wrong = await asEd("POST", "/account/two-factor/confirm", { code: "000000" });
    expect(wrong.json()).toMatchObject({ code: "INVALID_TWO_FACTOR_CODE" });

    const right = await asEd("POST", "/account/two-factor/confirm", {
      code: codeFor(setup.json().secret),
    });
    expect(right.json().recoveryCodes).toHaveLength(10);
    expect((await asEd("GET", "/account/two-factor")).json()).toMatchObject({
      enabled: true,
      recoveryCodesLeft: 10,
    });
  });

  // Setting up again used to swap the authenticator with no password, from any open session.
  it("can't be swapped for another phone while on, without the password", async () => {
    const { secret } = await turnOn(asEd);

    const again = await asEd("POST", "/account/two-factor/setup");

    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ code: "TWO_FACTOR_ALREADY_ON" });
    expect(again.body).not.toContain("otpauth");
    const stillMine = await asEd("POST", "/account/two-factor/confirm", {
      code: codeFor(secret),
    });
    expect(stillMine.json()).toMatchObject({ code: "TWO_FACTOR_ALREADY_ON" });
  });

  it("asks for a code after the password, and signs in only with a right one", async () => {
    const { secret } = await turnOn(asEd);

    const first = await signIn("ed@example.com");
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ twoFactorRequired: true, challengeToken: expect.any(String) });
    expect(first.cookies).toEqual([]);

    const wrong = await secondStep({ challengeToken: first.json().challengeToken, code: "123456" });
    expect(wrong.statusCode).toBe(401);

    const right = await secondStep({
      challengeToken: first.json().challengeToken,
      code: codeFor(secret, 1),
    });
    expect(right.statusCode).toBe(200);
    expect(right.json().user.email).toBe("ed@example.com");
    expect(right.cookies.some((cookie) => cookie.name === SESSION_COOKIE_NAME)).toBe(true);

    // The challenge is used up, and so is the code.
    const again = await secondStep({
      challengeToken: first.json().challengeToken,
      code: codeFor(secret, 1),
    });
    expect(again.json()).toMatchObject({ code: "SIGN_IN_EXPIRED" });
  });

  it("won't take the same code twice", async () => {
    const { secret } = await turnOn(asEd);
    const code = codeFor(secret, 1);
    const first = (await signIn("ed@example.com")).json().challengeToken;
    const second = (await signIn("ed@example.com")).json().challengeToken;

    expect((await secondStep({ challengeToken: first, code })).statusCode).toBe(200);
    expect((await secondStep({ challengeToken: second, code })).statusCode).toBe(401);
  });

  it("accepts each recovery code once", async () => {
    const { recoveryCodes } = await turnOn(asEd);
    const recoveryCode = recoveryCodes[0]!;

    const first = (await signIn("ed@example.com")).json().challengeToken;
    expect((await secondStep({ challengeToken: first, recoveryCode })).statusCode).toBe(200);

    const second = (await signIn("ed@example.com")).json().challengeToken;
    expect((await secondStep({ challengeToken: second, recoveryCode })).statusCode).toBe(401);
    expect((await asEd("GET", "/account/two-factor")).json().recoveryCodesLeft).toBe(9);
  });

  it("makes people start again after five wrong codes", async () => {
    const { secret } = await turnOn(asEd);
    const challengeToken = (await signIn("ed@example.com")).json().challengeToken;
    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await secondStep({ challengeToken, code: "000000" })).statusCode).toBe(401);
    }

    const sixth = await secondStep({ challengeToken, code: codeFor(secret, 1) });

    expect(sixth.json()).toMatchObject({ code: "SIGN_IN_EXPIRED" });
  });

  it("is turned off with the password, which also deletes the recovery codes", async () => {
    await turnOn(asEd);

    const wrongPassword = await asEd("POST", "/account/two-factor/disable", { password: "nope" });
    const disabled = await asEd("POST", "/account/two-factor/disable", { password: TEST_PASSWORD });

    expect(wrongPassword.json()).toMatchObject({ code: "WRONG_PASSWORD" });
    expect(disabled.statusCode).toBe(204);
    expect((await signIn("ed@example.com")).json().user.email).toBe("ed@example.com");
  });

  // LINTEL-SEC-013: someone at an unlocked computer could guess the password here for ever.
  it("limits password guesses when turning it off or making new recovery codes", async () => {
    await turnOn(asEd);
    const answers = { disable: [] as number[], codes: [] as number[] };
    for (let attempt = 0; attempt < 11; attempt++) {
      answers.disable.push(
        (await asEd("POST", "/account/two-factor/disable", { password: "guess" })).statusCode,
      );
      answers.codes.push(
        (await asEd("POST", "/account/two-factor/recovery-codes", { password: "guess" }))
          .statusCode,
      );
    }

    expect(answers.disable.slice(0, 10).every((status) => status === 401)).toBe(true);
    expect(answers.disable[10]).toBe(429);
    expect(answers.codes[10]).toBe(429);
  }, 30_000);

  it("makes a new set of recovery codes, replacing the old", async () => {
    const { recoveryCodes } = await turnOn(asEd);

    const fresh = await asEd("POST", "/account/two-factor/recovery-codes", {
      password: TEST_PASSWORD,
    });

    expect(fresh.json().recoveryCodes).toHaveLength(10);
    const challengeToken = (await signIn("ed@example.com")).json().challengeToken;
    expect((await secondStep({ challengeToken, recoveryCode: recoveryCodes[0]! })).statusCode).toBe(
      401,
    );
  });

  describe("when a role requires it", () => {
    let asOwner: SendRequest;

    beforeEach(async () => {
      asOwner = requestsAs(server, await signInAndGetCookies(server, "olive@example.com"));
      const editorRole = (await asOwner("GET", "/roles"))
        .json()
        .roles.find((role: { handle: string }) => role.handle === "editor");
      await asOwner("PATCH", `/roles/${editorRole.id}`, { requiresTwoFactor: true });
    });

    it("lets people sign in, but only to turn it on", async () => {
      const signedIn = await signIn("ed@example.com");
      const asNewEd = requestsAs(server, {
        [SESSION_COOKIE_NAME]: signedIn.cookies.find(
          (cookie) => cookie.name === SESSION_COOKIE_NAME,
        )!.value,
      });

      expect(signedIn.json().mustSetUpTwoFactor).toBe(true);
      const blocked = await asNewEd("GET", "/collections");
      expect(blocked.statusCode).toBe(403);
      expect(blocked.json()).toMatchObject({ code: "TWO_FACTOR_SETUP_REQUIRED" });
      expect((await asNewEd("GET", "/account")).statusCode).toBe(200);

      await turnOn(asNewEd);

      expect((await asNewEd("GET", "/auth/me")).json().mustSetUpTwoFactor).toBeUndefined();
      expect((await asNewEd("GET", "/collections")).statusCode).toBe(200);
    });

    it("can't be turned off", async () => {
      await turnOn(asEd);

      const response = await asEd("POST", "/account/two-factor/disable", {
        password: TEST_PASSWORD,
      });

      expect(response.json()).toMatchObject({ code: "TWO_FACTOR_REQUIRED" });
      expect(await testDatabase.database.select().from(twoFactorTable)).toHaveLength(1);
    });

    it("leaves people with other roles alone", async () => {
      expect((await asOwner("GET", "/collections")).statusCode).toBe(200);
    });
  });
});
