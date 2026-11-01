import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lintelBranding } from "../branding/branding.schema.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createPersonWithRole } from "../testing/test-people.js";
import { startTestServer } from "../testing/test-server.js";

describe("the admin's own emails", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase, {
      branding: {
        branding: {
          ...lintelBranding,
          productName: "Acme Studio",
          supportEmail: "help@acme.example",
        },
        isCustomised: true,
      },
    });
    await createPersonWithRole(testDatabase.database, "ed@example.com", "editor", "Ed");
  });

  afterEach(() => server.close());

  it("go out in the site's branding, never naming Lintel", async () => {
    await server.inject({
      method: "POST",
      url: "/auth/forgot-password",
      payload: { email: "ed@example.com" },
    });

    const email = server.emailOutbox?.latestTo("ed@example.com");
    expect(email?.subject).toBe("Reset your password · Acme Studio");
    expect(email?.html).toContain("Acme Studio");
    expect(email?.html).toContain("Choose a new password");
    expect(email?.text).toContain("help@acme.example");
    expect(`${email?.subject} ${email?.text} ${email?.html}`).not.toContain("Lintel");
  });
});
