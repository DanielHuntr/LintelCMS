import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { assetsTable } from "../media/media.table.js";
import { findRoleByHandle } from "../roles/roles.repository.js";
import { buildServer } from "../server.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

describe("dashboards", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let adminCookies: Record<string, string>;
  let editorCookies: Record<string, string>;

  beforeEach(async () => {
    server = buildServer({
      adminOrigin: "http://localhost:5173",
      database: testDatabase.activeDatabase,
      runScheduledJobs: false,
    });
    await server.ready();
    await ensurePagesCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    await createTestUser(testDatabase.database, "editor@example.com", [
      ["entries:read", "entries:update", "entries:create"],
    ]);
    adminCookies = await signInAndGetCookies(server, "admin@example.com");
    editorCookies = await signInAndGetCookies(server, "editor@example.com");
  });

  afterEach(() => server.close());

  function request(
    method: "GET" | "PUT" | "DELETE" | "POST" | "PATCH",
    url: string,
    cookies: Record<string, string>,
    payload?: object,
  ) {
    return server.inject({ method, url, payload, cookies });
  }

  const myLayout = [
    { widget: "core:recent-edits", size: "large" },
    { widget: "bookings:today", size: "small" },
  ];

  describe("someone's own layout", () => {
    it("is empty until they save one, so the admin shows its default", async () => {
      const response = await request("GET", "/dashboard/layout", editorCookies);
      expect(response.json()).toEqual({ widgets: null, source: "default" });
    });

    it("is saved per person and can be reset", async () => {
      const saved = await request("PUT", "/dashboard/layout", editorCookies, { widgets: myLayout });
      expect(saved.json()).toEqual({ widgets: myLayout, source: "user" });
      expect((await request("GET", "/dashboard/layout", editorCookies)).json().widgets).toEqual(
        myLayout,
      );
      expect((await request("GET", "/dashboard/layout", adminCookies)).json().widgets).toBeNull();

      const reset = await request("DELETE", "/dashboard/layout", editorCookies);
      expect(reset.json()).toEqual({ widgets: null, source: "default" });
    });

    it("refuses widgets twice, unknown sizes and odd ids", async () => {
      const twice = await request("PUT", "/dashboard/layout", editorCookies, {
        widgets: [myLayout[0], myLayout[0]],
      });
      expect(twice.statusCode).toBe(400);
      expect(twice.json().message).toContain("Each widget can only be on the dashboard once");

      const huge = await request("PUT", "/dashboard/layout", editorCookies, {
        widgets: [{ widget: "core:welcome", size: "enormous" }],
      });
      expect(huge.json().message).toContain("The size should be small, medium or large");

      const odd = await request("PUT", "/dashboard/layout", editorCookies, {
        widgets: [{ widget: "welcome", size: "small" }],
      });
      expect(odd.json().message).toContain('Widget ids look like "core:recent-edits"');
    });

    it("needs someone signed in", async () => {
      expect((await server.inject({ method: "GET", url: "/dashboard/layout" })).statusCode).toBe(
        401,
      );
    });
  });

  describe("a role's default layout", () => {
    it("is what people with the role start from, until they save their own", async () => {
      const role = await findRoleByHandle(
        testDatabase.database,
        "default",
        "editor@example.com-role-0",
      );
      const roleLayout = [{ widget: "core:scheduled", size: "medium" }];

      const saved = await request("PUT", `/dashboard/role-layouts/${role?.id}`, adminCookies, {
        widgets: roleLayout,
      });
      expect(saved.statusCode).toBe(200);
      const savedRole = saved.json().roles.find((listed: { id: string }) => listed.id === role?.id);
      expect(savedRole.widgets).toEqual(roleLayout);

      expect((await request("GET", "/dashboard/layout", editorCookies)).json()).toEqual({
        widgets: roleLayout,
        source: "role",
      });
      await request("PUT", "/dashboard/layout", editorCookies, { widgets: myLayout });
      expect((await request("GET", "/dashboard/layout", editorCookies)).json().source).toBe("user");
      expect((await request("DELETE", "/dashboard/layout", editorCookies)).json()).toEqual({
        widgets: roleLayout,
        source: "role",
      });

      await request("DELETE", `/dashboard/role-layouts/${role?.id}`, adminCookies);
      expect((await request("GET", "/dashboard/layout", editorCookies)).json().source).toBe(
        "default",
      );
    });

    it("can only be set by admins, for roles that exist", async () => {
      const list = await request("GET", "/dashboard/role-layouts", editorCookies);
      expect(list.statusCode).toBe(403);

      const missing = await request(
        "PUT",
        "/dashboard/role-layouts/00000000-0000-4000-8000-000000000000",
        adminCookies,
        { widgets: [] },
      );
      expect(missing.statusCode).toBe(404);
    });
  });

  describe("the built-in widgets", () => {
    async function makePage(title: string) {
      const created = await request("POST", "/collections/pages/entries", editorCookies, {
        data: { title },
      });
      return created.json().id as string;
    }

    it("show recent edits, newest first", async () => {
      await makePage("About us");
      await makePage("Contact");

      const response = await request("GET", "/dashboard/widgets/recent-edits", editorCookies);

      expect(response.json().entries.map((entry: { title: string }) => entry.title)).toEqual([
        "Contact",
        "About us",
      ]);
      expect(response.json().entries[0]).toMatchObject({
        status: "draft",
        collection: { handle: "pages", name: "Pages" },
        updatedByName: "Ana Editor",
        hasUnpublishedChanges: false,
      });
    });

    it("show the signed-in person's own recent edits", async () => {
      await makePage("Mine");
      await request("POST", "/collections/pages/entries", adminCookies, {
        data: { title: "Someone else's" },
      });

      const mine = await request("GET", "/dashboard/widgets/my-edits", editorCookies);

      expect(mine.json().entries.map((entry: { title: string }) => entry.title)).toEqual(["Mine"]);
    });

    it("show drafts and unpublished changes as needing attention, and what is scheduled", async () => {
      const draftId = await makePage("Draft");
      const liveId = await makePage("Live");
      const scheduledId = await makePage("Later");
      await request("POST", `/entries/${liveId}/publish`, adminCookies);
      await request("POST", `/entries/${scheduledId}/schedule`, adminCookies, {
        publishAt: new Date(Date.now() + 86_400_000).toISOString(),
      });

      const attention = await request("GET", "/dashboard/widgets/needs-attention", editorCookies);
      expect(attention.json().entries.map((entry: { id: string }) => entry.id)).toEqual([draftId]);

      await request("PATCH", `/entries/${liveId}`, adminCookies, {
        data: { title: "Live, changed" },
      });
      const again = await request("GET", "/dashboard/widgets/needs-attention", editorCookies);
      expect(again.json().total).toBe(2);

      const scheduled = await request("GET", "/dashboard/widgets/scheduled", editorCookies);
      expect(scheduled.json()).toMatchObject({ total: 1, entries: [{ id: scheduledId }] });
    });

    it("sum up the media library", async () => {
      await testDatabase.database
        .insert(assetsTable)
        .values([
          assetFixture("photo.jpg", "image/jpeg", 2000, "A bakery"),
          assetFixture("logo.png", "image/png", 500, ""),
          assetFixture("menu.pdf", "application/pdf", 1000, ""),
        ]);

      const response = await request("GET", "/dashboard/widgets/media-usage", adminCookies);

      expect(response.json()).toEqual({
        fileCount: 3,
        totalBytes: 3500,
        imageCount: 2,
        imagesWithoutAltText: 1,
      });
      expect(
        (await request("GET", "/dashboard/widgets/media-usage", editorCookies)).statusCode,
      ).toBe(403);
    });
  });
});

function assetFixture(filename: string, mimeType: string, size: number, alt: string) {
  return { filename, mimeType, size, alt, storageKey: filename, contentHash: filename };
}
