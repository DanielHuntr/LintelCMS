import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import { createPersonWithRole, tokenFromLatestEmail } from "../testing/test-people.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { signInAndGetCookies } from "../testing/test-users.js";
import type { OutgoingEmail } from "./email.schema.js";
import { createEmailSender } from "./email.service.js";
import { HIDDEN_LINK, type OutboxResponse } from "./outbox.service.js";

describe("the email outbox in Settings", () => {
  const testDatabase = useTestDatabase();

  describe("without a sender set up", () => {
    let server: FastifyInstance;
    let asOwner: SendRequest;

    beforeEach(async () => {
      server = await startTestServer(testDatabase.activeDatabase);
      await createPersonWithRole(testDatabase.database, "olive@example.com", "owner");
      asOwner = requestsAs(server, await signInAndGetCookies(server, "olive@example.com"));
    });

    afterEach(() => server.close());

    it("keeps messages in the outbox for admins to read", async () => {
      await server.inject({
        method: "POST",
        url: "/auth/forgot-password",
        payload: { email: "olive@example.com" },
      });

      const outbox = await asOwner("GET", "/email/outbox");

      expect(outbox.headers["cache-control"]).toBe("no-store");
      expect(outbox.json()).toMatchObject({
        enabled: true,
        messages: [{ to: "olive@example.com", subject: "Reset your password · Lintel" }],
      });
    });

    // LINTEL-SEC-001: an admin read the owner's reset link here and took over the account.
    it("is for owners only, so an admin can't read the owner's reset link", async () => {
      await createPersonWithRole(testDatabase.database, "adam@example.com", "admin");
      const asAdmin = requestsAs(server, await signInAndGetCookies(server, "adam@example.com"));
      await server.inject({
        method: "POST",
        url: "/auth/forgot-password",
        payload: { email: "olive@example.com" },
      });

      const outbox = await asAdmin("GET", "/email/outbox");

      expect(outbox.statusCode).toBe(403);
      expect(outbox.json()).toMatchObject({ code: "OWNERS_ONLY" });
      expect(outbox.body).not.toContain("token=");
    });

    it("hides the secret in links sent to other people, and keeps the reader's own", async () => {
      await createPersonWithRole(testDatabase.database, "oscar@example.com", "owner");
      for (const email of ["olive@example.com", "oscar@example.com"]) {
        await server.inject({ method: "POST", url: "/auth/forgot-password", payload: { email } });
      }
      const othersToken = tokenFromLatestEmail(server, "oscar@example.com");
      const ownToken = tokenFromLatestEmail(server, "olive@example.com");

      const outbox = await asOwner("GET", "/email/outbox");

      expect(outbox.body).not.toContain(othersToken);
      expect(outbox.body).toContain(ownToken);
      const toOscar = outbox
        .json<OutboxResponse>()
        .messages.find((message) => message.to === "oscar@example.com");
      expect(toOscar?.text).toContain(HIDDEN_LINK);
      expect(toOscar?.text).not.toContain("reset-password#token");
    });

    it("can't be read with an API token", async () => {
      const created = await asOwner("POST", "/api-tokens", {
        name: "Website",
        access: "readWrite",
      });
      const { secret } = created.json<{ secret: string }>();

      const outbox = await server.inject({
        method: "GET",
        url: "/email/outbox",
        headers: { authorization: `Bearer ${secret}` },
      });

      expect(outbox.statusCode).toBe(401);
    });
  });

  it("hands messages to the driver it is given, and has no outbox then", async () => {
    const sent: OutgoingEmail[] = [];
    const driver = {
      description: "a test driver",
      send: async (email: OutgoingEmail) => {
        sent.push(email);
        return {};
      },
    };
    const server = await startTestServer(testDatabase.activeDatabase, {
      email: createEmailSender(driver, { defaultFrom: "Lintel <hello@example.com>" }),
    });
    await createPersonWithRole(testDatabase.database, "olive@example.com", "owner");
    const asOwner = requestsAs(server, await signInAndGetCookies(server, "olive@example.com"));

    await server.inject({
      method: "POST",
      url: "/auth/forgot-password",
      payload: { email: "olive@example.com" },
    });

    await vi.waitFor(() => expect(sent.map((email) => email.to)).toEqual([["olive@example.com"]]));
    expect((await asOwner("GET", "/email/outbox")).json()).toEqual({
      enabled: false,
      messages: [],
    });
    await server.close();
  });
});
