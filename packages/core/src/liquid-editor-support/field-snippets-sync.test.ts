import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { parseSnippetsText } from "./snippets-file.repository.js";

describe("field snippets in development", { timeout: 30000 }, () => {
  const testDatabase = useTestDatabase();
  let root: string;
  let server: FastifyInstance | undefined;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "lintel-snippets-sync-"));
  });

  afterEach(async () => {
    await server?.close();
    server = undefined;
    await rm(root, { recursive: true, force: true });
  });

  const fieldsFile = () => join(root, ".vscode", "lintel-fields.code-snippets");

  async function start(development: boolean) {
    server = await startTestServer(testDatabase.activeDatabase, {
      website: {
        liquidTemplates: {
          folder: join(root, "site"),
          development,
          editorSnippetsFolder: join(root, ".vscode"),
        },
      },
    });
    return server;
  }

  async function snippetNames(): Promise<string[]> {
    return Object.keys(parseSnippetsText(await readFile(fieldsFile(), "utf8"), "fields"));
  }

  it("are written when the server starts and again after a content type changes", async () => {
    await mkdir(join(root, "site"), { recursive: true });
    const api = await start(true);
    expect(existsSync(join(root, ".vscode", "lintel-liquid.code-snippets"))).toBe(true);
    expect(await snippetNames()).not.toContain("Lintel: event.venue");

    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    const admin = requestsAs(api, await signInAndGetCookies(api, "admin@example.com"));
    const created = await admin("POST", "/blueprints", {
      handle: "event",
      name: "Event",
      fields: [
        { handle: "title", label: "Title", type: "text", required: true },
        { handle: "venue", label: "Venue", type: "text" },
      ],
    });
    expect(created.statusCode).toBe(201);
    await vi.waitFor(async () => expect(await snippetNames()).toContain("Lintel: event.venue"), {
      timeout: 5000,
    });
  });

  it("aren't written for a project without a templates folder", async () => {
    await start(true);
    expect(existsSync(join(root, ".vscode"))).toBe(false);
  });

  it("aren't written outside development", async () => {
    await mkdir(join(root, "site"), { recursive: true });
    await start(false);
    expect(existsSync(join(root, ".vscode"))).toBe(false);
  });
});
