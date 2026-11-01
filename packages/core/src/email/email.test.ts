import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import { createPersonWithRole } from "../testing/test-people.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { signInAndGetCookies } from "../testing/test-users.js";
import type { EmailMessage } from "./email.js";

describe("email", () => {
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
        messages: [{ to: "olive@example.com", subject: "Reset your Lintel password" }],
      });
    });
  });

  it("hands messages to the sender it is given, and has no outbox then", async () => {
    const sent: EmailMessage[] = [];
    const server = await startTestServer(testDatabase.activeDatabase, {
      email: { send: async (message) => void sent.push(message) },
    });
    await createPersonWithRole(testDatabase.database, "olive@example.com", "owner");
    const asOwner = requestsAs(server, await signInAndGetCookies(server, "olive@example.com"));

    await server.inject({
      method: "POST",
      url: "/auth/forgot-password",
      payload: { email: "olive@example.com" },
    });

    expect(sent.map((message) => message.to)).toEqual(["olive@example.com"]);
    expect((await asOwner("GET", "/email/outbox")).json()).toEqual({
      enabled: false,
      messages: [],
    });
    await server.close();
  });
});
