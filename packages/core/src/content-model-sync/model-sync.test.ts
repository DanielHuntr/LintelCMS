import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureBlogPostsCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { DataLossNotAllowedError, diffModel, pullModel, pushModel } from "./model-commands.js";
import type { ContentModelOptions } from "./model-sync.service.js";

/**
 * The content model folder and the database kept in step: the commands, the live sync in
 * development, and the rules in production.
 */

const postFile = (folder: string) => join(folder, "content-types", "post.ts");

// Each test reads TypeScript files and opens servers, which takes a few seconds on a busy machine.
describe("content model sync", { timeout: 30_000 }, () => {
  const testDatabase = useTestDatabase();
  let folder: string;
  let server: FastifyInstance | undefined;
  let api: SendRequest;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-model-sync-"));
    await ensureBlogPostsCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "ana@example.com", [["*"]]);
  });

  afterEach(async () => {
    await server?.close();
    server = undefined;
    await rm(folder, { recursive: true, force: true });
  });

  async function start(options: Partial<ContentModelOptions> = {}) {
    server = await startTestServer(testDatabase.activeDatabase, {
      contentModel: {
        folder,
        folderLabel: "content-model",
        mode: "development",
        editableInAdmin: true,
        format: "typescript",
        watch: false,
        ...options,
      },
    });
    api = requestsAs(server, await signInAndGetCookies(server, "ana@example.com"));
    return server;
  }

  async function editPostFile(change: (text: string) => string) {
    await writeFile(postFile(folder), change(await readFile(postFile(folder), "utf8")));
  }

  async function createPosts(excerpts: (string | null)[]) {
    for (const [index, excerpt] of excerpts.entries()) {
      const response = await api("POST", "/collections/posts/entries", {
        data: { title: `Post ${index + 1}`, excerpt },
      });
      expect(response.statusCode).toBe(201);
    }
  }

  async function fieldHandles(blueprint: string): Promise<string[]> {
    const response = await api("GET", `/blueprints/${blueprint}`);
    return response.json<{ fields: { handle: string }[] }>().fields.map((field) => field.handle);
  }

  describe("commands", () => {
    it("pulls the database into files, and pushes an edited file back", async () => {
      // Without a folder the server leaves files alone, so pull is what makes them.
      await rm(folder, { recursive: true, force: true });
      await start();
      const pulled = await pullModel(testDatabase.database, folder, "typescript");
      // Forward slashes, so the list reads the same on Windows.
      const written = pulled.written.map((path) =>
        path.slice(folder.length + 1).replaceAll("\\", "/"),
      );
      expect(written.sort()).toEqual([
        "content-types/post.ts",
        "taxonomies/categories.ts",
        "taxonomies/tags.ts",
      ]);

      await editPostFile((text) =>
        text
          .replace(
            "featured_image: image(),",
            "featured_image: image(),\n    subtitle: text({ maxLength: 120 }),",
          )
          .replace('name: "Blog post"', 'name: "Article"'),
      );
      const diff = await diffModel(testDatabase.database, folder);
      expect(diff.changes.map((change) => change.summary)).toEqual([
        "Rename the content type Blog post to Article",
        "Add the field `subtitle` to Article",
      ]);

      await pushModel(testDatabase.database, folder);
      expect(await fieldHandles("post")).toEqual([
        "title",
        "excerpt",
        "featured_image",
        "subtitle",
        "body",
        "categories",
        "tags",
      ]);
    });

    it("refuses a push that would delete content, saying what it would delete", async () => {
      await start();
      await createPosts(["First", "Second", null]);
      await pullModel(testDatabase.database, folder, "typescript");
      await editPostFile((text) => text.replace(/\n {4}excerpt: [^\n]+/, ""));

      const refused = pushModel(testDatabase.database, folder);

      await expect(refused).rejects.toBeInstanceOf(DataLossNotAllowedError);
      await expect(refused).rejects.toThrow(
        "Removing `excerpt` would delete text from 2 entries in Blog posts.",
      );
      expect(await fieldHandles("post")).toContain("excerpt");

      await pushModel(testDatabase.database, folder, { allowDataLoss: true });
      expect(await fieldHandles("post")).not.toContain("excerpt");
      const list = await api("GET", "/collections/posts/entries");
      const ids = list.json<{ entries: { id: string }[] }>().entries.map((item) => item.id);
      for (const id of ids) {
        const entry = await api("GET", `/entries/${id}`);
        expect(entry.json<{ data: Record<string, unknown> }>().data).not.toHaveProperty("excerpt");
      }
    });

    it("goes ahead with a removal when there is nothing to lose", async () => {
      await start();
      await createPosts([null]);
      await pullModel(testDatabase.database, folder, "typescript");
      await editPostFile((text) => text.replace(/\n {4}excerpt: [^\n]+/, ""));

      const diff = await pushModel(testDatabase.database, folder);

      expect(diff.changes).toEqual([
        expect.objectContaining({
          summary: "Remove the field `excerpt` from Blog post",
          destructive: false,
        }),
      ]);
    });

    it("explains removing a content type with entries", async () => {
      await start();
      await createPosts(["One"]);
      await pullModel(testDatabase.database, folder, "typescript");
      await rm(postFile(folder));

      const diff = await diffModel(testDatabase.database, folder);

      expect(
        diff.changes.filter((change) => change.destructive).map((change) => change.impact),
      ).toEqual(["Removing Blog posts would delete 1 entry in Blog posts."]);
    });
  });

  describe("in development", () => {
    it("writes changes made in the admin to the files", async () => {
      const running = await start();
      await pullModel(testDatabase.database, folder, "typescript");

      const created = await api("POST", "/taxonomies", { handle: "topics", name: "Topics" });
      expect(created.statusCode).toBe(201);
      await running.contentModelSync?.sync();

      expect(await readFile(join(folder, "taxonomies", "topics.ts"), "utf8")).toContain(
        'name: "Topics"',
      );
    });

    it("applies file edits to the database and tells the admin to reload", async () => {
      const running = await start();
      await pullModel(testDatabase.database, folder, "typescript");
      const events: string[] = [];
      running.contentModelEvents.subscribe((event) => events.push(event));

      await editPostFile((text) =>
        text
          .replace("body: richText(),", "body: richText(),\n    reading_time: number(),")
          .replace("image,", "image,\n  number,"),
      );
      const result = await running.contentModelSync?.sync();

      expect(result?.databaseChanged).toBe(true);
      expect(await fieldHandles("post")).toContain("reading_time");
      expect(events).toContain("model-changed");
    });

    it("keeps the file's version when both changed, and says so", async () => {
      const running = await start();
      await pullModel(testDatabase.database, folder, "typescript");
      await api("PUT", "/taxonomies/tags", { name: "Labels" });
      await writeFile(
        join(folder, "taxonomies", "tags.ts"),
        (await readFile(join(folder, "taxonomies", "tags.ts"), "utf8")).replace(
          '"Tags"',
          '"Keywords"',
        ),
      );

      await running.contentModelSync?.sync();

      const tags = await api("GET", "/taxonomies/tags");
      expect(tags.json()).toMatchObject({ name: "Keywords" });
      const status = await api("GET", "/content-model/status");
      expect(status.json()).toMatchObject({
        managedInCode: true,
        editableInAdmin: true,
        notices: [
          {
            message:
              "The taxonomy Keywords was changed here and in content-model/taxonomies/tags.ts at the same time. " +
              "The version in the file was kept, so the change made here was undone.",
          },
        ],
      });
    });

    it("shows what's wrong with a file instead of syncing", async () => {
      const running = await start();
      await pullModel(testDatabase.database, folder, "typescript");
      await writeFile(
        join(folder, "taxonomies", "tags.ts"),
        'export default { kind: "taxonomy", handle: "tags" };',
      );

      await running.contentModelSync?.sync();

      const status = await api("GET", "/content-model/status");
      expect(status.json<{ problems: string[] }>().problems).toContain(
        'taxonomies/tags.ts: "name" is missing',
      );
    });
  });

  describe("in production", () => {
    it("applies additive changes from the files when the server starts", async () => {
      await writeFile(
        join(folder, "topics.yaml"),
        "kind: taxonomy\nhandle: topics\nname: Topics\n",
      );
      await writeFile(join(folder, "tags.yaml"), "kind: taxonomy\nhandle: tags\nname: Tags\n");
      await writeFile(
        join(folder, "categories.yaml"),
        "kind: taxonomy\nhandle: categories\nname: Categories\n",
      );
      await start({ mode: "production", editableInAdmin: false });

      const taxonomies = await api("GET", "/taxonomies");
      expect(
        taxonomies
          .json<{ taxonomies: { handle: string }[] }>()
          .taxonomies.map((taxonomy) => taxonomy.handle),
      ).toContain("topics");
      // Blog posts aren't in the files, but have no entries, so they were removed too.
      expect((await api("GET", "/collections/posts")).statusCode).toBe(404);
    });

    it("waits for a confirmation before deleting content, then makes the change", async () => {
      await start();
      await createPosts(["Kept for now"]);
      await pullModel(testDatabase.database, folder, "typescript");
      await server?.close();
      await editPostFile((text) => text.replace(/\n {4}excerpt: [^\n]+/, ""));

      await start({ mode: "production", editableInAdmin: false });
      const status = await api("GET", "/content-model/status");
      expect(status.json()).toMatchObject({
        pending: [
          {
            summary: "Remove the field `excerpt` from Blog post",
            impact: "Removing `excerpt` would delete text from 1 entry in Blog posts.",
            destructive: true,
          },
        ],
      });
      expect(await fieldHandles("post")).toContain("excerpt");

      const applied = await api("POST", "/content-model/pending/apply");
      expect(applied.statusCode).toBe(200);
      expect(applied.json()).toMatchObject({ pending: [] });
      expect(await fieldHandles("post")).not.toContain("excerpt");
    });

    it("refuses schema changes in the admin, but not content", async () => {
      await start();
      await pullModel(testDatabase.database, folder, "typescript");
      await server?.close();
      await start({ mode: "production", editableInAdmin: false });

      const refused = await api("POST", "/taxonomies", { handle: "topics", name: "Topics" });
      expect(refused.statusCode).toBe(409);
      expect(refused.json()).toMatchObject({ code: "CONTENT_MODEL_MANAGED_IN_CODE" });
      expect((await api("PUT", "/blueprints/post", { name: "Post", fields: [] })).statusCode).toBe(
        409,
      );

      expect((await api("POST", "/taxonomies/tags/terms", { title: "Recipes" })).statusCode).toBe(
        201,
      );
      const preview = await api("PUT", "/collections/posts", {
        previewUrlPattern: "https://example.com/preview?path={url}&token={token}",
      });
      expect(preview.statusCode).toBe(200);
      expect((await api("GET", "/content-model/status")).json()).toMatchObject({
        managedInCode: true,
        editableInAdmin: false,
      });
    });
  });

  it("isn't managed in code while there is no folder", async () => {
    await rm(folder, { recursive: true, force: true });
    await start({ mode: "production", editableInAdmin: false });

    expect(
      (await api("POST", "/taxonomies", { handle: "topics", name: "Topics" })).statusCode,
    ).toBe(201);
    expect((await api("GET", "/content-model/status")).json()).toMatchObject({
      managedInCode: false,
    });
  });
});
