import { describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { entriesTable } from "../entries/entries.table.js";
import { useTestDatabase } from "../testing/test-database.js";
import { makeTestPng, useMediaTestServer } from "../testing/test-media.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

/**
 * Request bodies only change what their schema names. Anything else a client adds (an
 * owner, a tenant, a status, where a file is stored) is dropped before it reaches a service.
 */
describe("what a request body can change", () => {
  const testDatabase = useTestDatabase();
  const media = useMediaTestServer(testDatabase);

  it("ignores ids, owners, tenants and statuses sent in an entry update", async () => {
    await ensurePagesCollection(testDatabase.database);
    const created = await media.server.inject({
      method: "POST",
      url: "/collections/pages/entries",
      cookies: media.adminCookies,
      payload: { data: { title: "About" } },
    });
    const entryId = created.json().id as string;
    await createTestUser(testDatabase.database, "other@example.com", [["*"]]);
    const otherCookies = await signInAndGetCookies(media.server, "other@example.com");

    const updated = await media.server.inject({
      method: "PATCH",
      url: `/entries/${entryId}`,
      cookies: otherCookies,
      payload: {
        data: { title: "About us" },
        id: crypto.randomUUID(),
        tenantId: "someone-else",
        authorId: crypto.randomUUID(),
        status: "published",
        publishedAt: new Date().toISOString(),
        collectionId: crypto.randomUUID(),
      },
    });

    expect(updated.statusCode).toBe(200);
    const [row] = await testDatabase.database.select().from(entriesTable);
    expect(row).toMatchObject({ id: entryId, tenantId: "default" });
    expect(updated.json().id).toBe(entryId);
    expect(updated.json().status).not.toBe("published");
  });

  it("ignores where a file is stored and what type it is when an asset is renamed", async () => {
    const uploaded = await media.upload("photo.png", await makeTestPng());
    const assetId = uploaded.json().id as string;

    const renamed = await media.server.inject({
      method: "PATCH",
      url: `/media/${assetId}`,
      cookies: media.adminCookies,
      payload: {
        filename: '../../<img src=x onerror="alert(1)">.html',
        storageKey: "../../etc/passwd",
        mimeType: "text/html",
      },
    });

    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().mimeType).toBe("image/png");
    expect(renamed.json().filename).not.toMatch(/[<>"/]/);
    expect(renamed.json().filename.endsWith(".png")).toBe(true);
    const file = await media.server.inject({ url: `/media/${assetId}/file` });
    expect(file.statusCode).toBe(200);
    expect(file.headers["content-type"]).toBe("image/png");
  });

  it("does not accept batches of GraphQL queries", async () => {
    const response = await media.server.inject({
      method: "POST",
      url: "/graphql",
      payload: [{ query: "{ __typename }" }, { query: "{ __typename }" }],
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  });
});
