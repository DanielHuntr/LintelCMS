import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { permissionsForApiToken } from "./api-token-access.js";
import { apiTokensTable } from "./api-tokens.table.js";

describe("API tokens", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let adminCookies: Record<string, string>;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await ensurePagesCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    adminCookies = await signInAndGetCookies(server, "admin@example.com");
  });

  afterEach(() => server.close());

  async function createToken(name: string, access: "read" | "readWrite", cookies = adminCookies) {
    const response = await server.inject({
      method: "POST",
      url: "/api-tokens",
      cookies,
      payload: { name, access },
    });
    return response;
  }

  function withToken(secret: string, method: "GET" | "POST", url: string, payload?: object) {
    return server.inject({
      method,
      url,
      headers: { authorization: `Bearer ${secret}` },
      ...(payload && { payload }),
    });
  }

  it("shows the token once, keeps only a hash, and lists it without the secret", async () => {
    const created = await createToken("Marketing website", "read");

    expect(created.statusCode).toBe(201);
    expect(created.headers["cache-control"]).toBe("no-store");
    const { token, secret } = created.json();
    expect(secret).toMatch(/^lintel_[\w-]{43}$/);
    expect(token).toMatchObject({
      name: "Marketing website",
      access: "read",
      tokenStart: secret.slice(0, 11),
      lastUsedAt: null,
      createdBy: { name: "Ana Editor" },
    });

    const [stored] = await testDatabase.database.select().from(apiTokensTable);
    expect(stored?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(secret);

    const list = await server.inject({ method: "GET", url: "/api-tokens", cookies: adminCookies });
    expect(list.json().tokens).toHaveLength(1);
    expect(list.body).not.toContain(secret);
  });

  it("lets a read token read published content but not drafts, and records when it was used", async () => {
    const { secret } = (await createToken("Website", "read")).json();

    const read = await withToken(secret, "GET", "/collections");
    const published = await withToken(secret, "GET", "/delivery/pages");
    const drafts = await withToken(secret, "GET", "/collections/pages/entries");
    const write = await withToken(secret, "POST", "/collections/pages/entries", {
      data: { title: "Sneaky" },
    });

    expect(read.statusCode).toBe(200);
    expect(published.statusCode).toBe(200);
    expect(drafts.statusCode).toBe(403);
    expect(write.statusCode).toBe(403);
    expect(write.json().message).toContain("entries:create");
    const list = await server.inject({ method: "GET", url: "/api-tokens", cookies: adminCookies });
    expect(list.json().tokens[0].lastUsedAt).not.toBeNull();
  });

  it("lets a read-write token create and publish, acting for the admin who made it", async () => {
    const { secret } = (await createToken("Import script", "readWrite")).json();

    const created = await withToken(secret, "POST", "/collections/pages/entries", {
      data: { title: "From a script" },
    });
    const published = await withToken(secret, "POST", `/entries/${created.json().id}/publish`);

    expect(created.statusCode).toBe(201);
    expect(created.json().updatedBy).toMatchObject({ name: "Ana Editor" });
    expect(published.json().status).toBe("published");
  });

  it("never reaches settings, whatever its access", async () => {
    const { secret } = (await createToken("Script", "readWrite")).json();

    expect((await withToken(secret, "GET", "/api-tokens")).statusCode).toBe(403);
    expect((await withToken(secret, "GET", "/plugins")).statusCode).toBe(403);
  });

  it("refuses a wrong or deleted token with a message that says so", async () => {
    const { token, secret } = (await createToken("Old site", "read")).json();

    const wrong = await withToken("lintel_not-a-real-token", "GET", "/collections");
    const deleted = await server.inject({
      method: "DELETE",
      url: `/api-tokens/${token.id}`,
      cookies: adminCookies,
    });
    const afterDelete = await withToken(secret, "GET", "/collections");

    expect(wrong.statusCode).toBe(401);
    expect(wrong.json().code).toBe("INVALID_API_TOKEN");
    expect(deleted.statusCode).toBe(204);
    expect(afterDelete.statusCode).toBe(401);
    const again = await server.inject({
      method: "DELETE",
      url: `/api-tokens/${token.id}`,
      cookies: adminCookies,
    });
    expect(again.statusCode).toBe(404);
  });

  it("needs settings permissions to manage tokens, and a name", async () => {
    await createTestUser(testDatabase.database, "editor@example.com", [["entries:*"]]);
    const editorCookies = await signInAndGetCookies(server, "editor@example.com");

    expect((await createToken("Mine", "read", editorCookies)).statusCode).toBe(403);
    const nameless = await createToken("  ", "read");
    expect(nameless.statusCode).toBe(400);
    expect(nameless.json().message).toContain("Please give the token a name");
  });
});

describe("what a token may do", () => {
  it("is limited to what the admin who made it may do", () => {
    expect(permissionsForApiToken("read", ["*"])).toEqual([
      "blueprints:read",
      "collections:read",
      "media:read",
    ]);
    expect(permissionsForApiToken("readWrite", ["entries:read", "entries:update"])).toEqual([
      "entries:read",
      "entries:update",
    ]);
  });
});
