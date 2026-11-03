import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setEnabledPlugins } from "../plugins/plugins.service.js";
import { builtInRoles } from "../roles/built-in-roles.js";
import { hasPermission } from "../roles/permissions.js";
import { buildServer } from "../server.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import type { ModelRunner, WritingRequest } from "./model-runner.js";
import type { WritingModel } from "./writing-model.js";

const GIGABYTE = 1024 ** 3;

/** A small stand-in model: two files of made-up bytes, published with their checksums. */
const firstFile = Buffer.alloc(300_000, 7);
const secondFile = Buffer.alloc(120_000, 9);
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/**
 * A stand-in for the model's repository on a local port. It answers Range requests, as the
 * real one does, can send the wrong bytes, and can hang up half-way through a file.
 */
class StandInRepository {
  private server: Server | undefined;
  wrongBytes = false;
  /** Stops after this many bytes of a response, to try resuming. */
  hangUpAfter: number | null = null;
  /** Keeps the connection open after `hangUpAfter` bytes instead of hanging up. */
  stall = false;
  ranges: Array<string | undefined> = [];

  get address() {
    return `http://127.0.0.1:${(this.server?.address() as AddressInfo).port}`;
  }

  async start() {
    this.server = createServer((request, response) => {
      const bytes = request.url?.endsWith("first.gguf") ? firstFile : secondFile;
      const body = this.wrongBytes ? Buffer.alloc(bytes.length, 1) : bytes;
      const range = request.headers.range;
      this.ranges.push(range);
      const from = range ? Number(/bytes=(\d+)-/.exec(range)?.[1] ?? 0) : 0;
      const rest = body.subarray(from);
      response.writeHead(range ? 206 : 200, { "content-length": rest.length });
      if (this.hangUpAfter !== null) {
        response.write(rest.subarray(0, this.hangUpAfter));
        if (!this.stall) setTimeout(() => response.destroy(), 50);
        return;
      }
      response.end(rest);
    });
    await new Promise<void>((resolve) => this.server?.listen(0, "127.0.0.1", resolve));
  }

  async stop() {
    await new Promise((resolve) => this.server?.close(resolve));
  }

  model(): WritingModel {
    return {
      id: "stand-in-model",
      name: "Stand-in model",
      maker: "Lintel's tests",
      licence: "Apache License 2.0",
      licenceUrl: "https://www.apache.org/licenses/LICENSE-2.0",
      sourcePage: this.address,
      files: [
        {
          name: "first.gguf",
          url: `${this.address}/first.gguf`,
          sizeInBytes: firstFile.length,
          sha256: sha256(firstFile),
        },
        {
          name: "second.gguf",
          url: `${this.address}/second.gguf`,
          sizeInBytes: secondFile.length,
          sha256: sha256(secondFile),
        },
      ],
      memoryNeededInBytes: 6 * GIGABYTE,
    };
  }
}

/** A stand-in writing model: answers with whatever the test sets, and records what it was asked. */
class StandInRunner implements ModelRunner {
  answer = "";
  asked: Array<{ modelPath: string; request: WritingRequest }> = [];
  loaded = false;
  /** When set, writing waits until the signal is aborted. */
  waitForStop = false;
  write = vi.fn(async (modelPath: string, request: WritingRequest) => {
    this.loaded = true;
    this.asked.push({ modelPath, request });
    request.onProgress(10);
    if (this.waitForStop) {
      await new Promise((_resolve, reject) =>
        request.signal.addEventListener("abort", () => reject(request.signal.reason)),
      );
    }
    return this.answer;
  });
  isLoaded = () => this.loaded;
  unload = vi.fn(async () => {
    this.loaded = false;
  });
}

const goodPlan = {
  sections: [
    { kind: "welcome", heading: "Fresh bread daily", text: "Baked at dawn.", button: "Visit" },
    {
      kind: "questions",
      heading: "Questions",
      items: [
        { question: "Open Sundays?", answer: "Yes, till noon." },
        { question: "Gluten free?", answer: "Some days." },
        { question: "Order ahead?", answer: "Call us at [phone]." },
      ],
    },
  ],
};

describe("page drafting", () => {
  const testDatabase = useTestDatabase();
  const repository = new StandInRepository();
  let runner: StandInRunner;
  let folder = "";
  let server: FastifyInstance;
  let admin: Record<string, string>;
  let freeMemory = 16 * GIGABYTE;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-page-drafts-"));
    await repository.start();
    repository.wrongBytes = false;
    repository.hangUpAfter = null;
    repository.stall = false;
    repository.ranges = [];
    runner = new StandInRunner();
    freeMemory = 16 * GIGABYTE;
    server = buildServer({
      adminOrigin: "http://localhost:5173",
      database: testDatabase.activeDatabase,
      publicApiUrl: "http://api.test",
      pageDrafts: {
        modelsFolder: folder,
        model: repository.model(),
        runner,
        freeMemoryInBytes: () => freeMemory,
        totalMemoryInBytes: () => 16 * GIGABYTE,
      },
    });
    await server.ready();
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    await setEnabledPlugins(testDatabase.database, server.plugins, ["drafts"]);
    admin = await signInAndGetCookies(server, "admin@example.com");
  });

  afterEach(async () => {
    await server.close();
    await repository.stop();
    await rm(folder, { recursive: true, force: true });
  });

  const request = (
    method: "GET" | "POST" | "DELETE",
    url: string,
    payload?: object,
    cookies = admin,
  ) => server.inject({ method, url, payload, cookies });

  async function install() {
    expect((await request("POST", "/drafts/model/download")).statusCode).toBe(202);
    await server.pageDrafts.setup.finished;
  }

  async function finishedJob(jobId: string, cookies = admin) {
    await server.pageDrafts.desk.settled();
    return (await request("GET", `/drafts/jobs/${jobId}`, undefined, cookies)).json();
  }

  describe("while the plugin is off", () => {
    it("answers nothing and never touches the model", async () => {
      await setEnabledPlugins(testDatabase.database, server.plugins, []);
      for (const [method, url] of [
        ["GET", "/drafts/model"],
        ["POST", "/drafts/model/download"],
        ["POST", "/drafts/page"],
      ] as const) {
        const response = await request(method, url, { purpose: "A bakery" });
        expect(response.statusCode).toBe(404);
        expect(response.json().code).toBe("PLUGIN_NOT_ENABLED");
      }
      expect(runner.write).not.toHaveBeenCalled();
      expect(await readdir(folder)).toEqual([]);
    });
  });

  describe("setting up the model", () => {
    it("says what it is, where it comes from and where it goes, before anything is downloaded", async () => {
      const status = (await request("GET", "/drafts/model")).json();
      expect(status).toMatchObject({
        state: "not-installed",
        bytesOnDisk: 0,
        folder: join(folder, "stand-in-model"),
        model: {
          name: "Stand-in model",
          licence: "Apache License 2.0",
          sizeInBytes: firstFile.length + secondFile.length,
          files: [{ name: "first.gguf", url: `${repository.address}/first.gguf` }, {}],
        },
        server: { hasEnoughMemory: true, hasEnoughDisk: true },
      });
      expect(repository.ranges).toEqual([]);
    });

    it("downloads and checks every file, then is installed", async () => {
      await install();
      const status = (await request("GET", "/drafts/model")).json();
      expect(status).toMatchObject({ state: "installed", problem: null });
      expect((await stat(join(folder, "stand-in-model", "first.gguf"))).size).toBe(
        firstFile.length,
      );
      expect((await request("GET", "/drafts/status")).json()).toEqual({ ready: true, busy: false });
    });

    it("refuses and deletes a file whose checksum is wrong", async () => {
      repository.wrongBytes = true;
      await install();
      const status = (await request("GET", "/drafts/model")).json();
      expect(status.state).toBe("failed");
      expect(status.problem).toMatch(/first\.gguf isn't the file the model's makers published/);
      expect(await readdir(join(folder, "stand-in-model"))).toEqual([]);
      expect((await request("GET", "/drafts/status")).json().ready).toBe(false);
    });

    it("resumes a broken download where it stopped", async () => {
      repository.hangUpAfter = 100_000;
      await install();
      const paused = (await request("GET", "/drafts/model")).json();
      expect(paused.bytesOnDisk).toBe(100_000);
      repository.hangUpAfter = null;
      await install();
      expect(repository.ranges).toContain("bytes=100000-");
      expect((await request("GET", "/drafts/model")).json().state).toBe("installed");
    });

    it("keeps what arrived when cancelled, so it can resume", async () => {
      repository.hangUpAfter = 50_000;
      repository.stall = true;
      expect((await request("POST", "/drafts/model/download")).statusCode).toBe(202);
      await vi.waitFor(async () =>
        expect((await request("GET", "/drafts/model")).json().bytesOnDisk).toBe(50_000),
      );
      expect((await request("GET", "/drafts/model")).json().state).toBe("downloading");
      const status = (await request("POST", "/drafts/model/download/cancel")).json();
      expect(status).toMatchObject({ state: "paused", bytesOnDisk: 50_000 });
    });

    it("finds and checks files copied into the folder by hand", async () => {
      const modelFolder = join(folder, "stand-in-model");
      await mkdir(modelFolder, { recursive: true });
      await writeFile(join(modelFolder, "first.gguf"), firstFile);
      expect((await request("POST", "/drafts/model/check")).statusCode).toBe(202);
      await server.pageDrafts.setup.finished;
      expect((await request("GET", "/drafts/model")).json()).toMatchObject({
        state: "failed",
        problem: "second.gguf isn't in the folder yet.",
      });
      await writeFile(join(modelFolder, "second.gguf"), secondFile);
      await request("POST", "/drafts/model/check");
      await server.pageDrafts.setup.finished;
      expect((await request("GET", "/drafts/model")).json().state).toBe("installed");
      expect(repository.ranges).toEqual([]);
    });

    it("removes the model's files", async () => {
      await install();
      const status = (await request("DELETE", "/drafts/model")).json();
      expect(status.state).toBe("not-installed");
      expect(await readdir(folder)).toEqual([]);
      expect(runner.unload).toHaveBeenCalled();
    });

    it("says plainly when the server has too little memory", async () => {
      await server.close();
      server = buildServer({
        adminOrigin: "http://localhost:5173",
        database: testDatabase.activeDatabase,
        publicApiUrl: "http://api.test",
        pageDrafts: {
          modelsFolder: folder,
          model: repository.model(),
          runner,
          totalMemoryInBytes: () => 4 * GIGABYTE,
        },
      });
      await server.ready();
      admin = await signInAndGetCookies(server, "admin@example.com");
      const status = (await request("GET", "/drafts/model")).json();
      expect(status.server.hasEnoughMemory).toBe(false);
    });
  });

  describe("drafting a page", () => {
    it("asks the model for exactly the chosen sections, and returns the checked plan", async () => {
      await install();
      runner.answer = JSON.stringify(goodPlan);
      const started = await request("POST", "/drafts/page", {
        purpose: "The home page of a small bakery",
        audience: "People who live nearby",
        tone: "friendly",
        sections: ["welcome", "questions"],
      });
      expect(started.statusCode).toBe(202);
      const job = await finishedJob(started.json().id);
      expect(job).toMatchObject({ state: "done", result: { plan: goodPlan } });

      const asked = runner.asked[0];
      expect(asked?.modelPath).toBe(join(folder, "stand-in-model", "first.gguf"));
      expect(asked?.request.prompt).toContain("The home page of a small bakery");
      const sections = (asked?.request.jsonSchema.properties as Record<string, object>).sections;
      expect(sections).toMatchObject({ minItems: 2, maxItems: 2 });
    });

    it("refuses before the model is installed", async () => {
      const response = await request("POST", "/drafts/page", { purpose: "A bakery" });
      expect(response.statusCode).toBe(409);
      expect(response.json().code).toBe("MODEL_NOT_INSTALLED");
    });

    it("fails plainly when the model's answer isn't a plan", async () => {
      await install();
      runner.answer = JSON.stringify({ sections: [{ kind: "gallery" }] });
      const started = await request("POST", "/drafts/page", { purpose: "A bakery" });
      const job = await finishedJob(started.json().id);
      expect(job).toMatchObject({ state: "failed", result: null });
      expect(job.problem).toMatch(/incomplete/);
    });

    it("writes one draft at a time, and can be stopped", async () => {
      await install();
      runner.waitForStop = true;
      const first = (await request("POST", "/drafts/page", { purpose: "A bakery" })).json();
      const second = await request("POST", "/drafts/rewrite", { text: "Hi", style: "shorter" });
      expect(second.statusCode).toBe(409);
      expect(second.json().code).toBe("DRAFTING_BUSY");
      await request("POST", `/drafts/jobs/${first.id}/stop`);
      expect((await finishedJob(first.id)).state).toBe("stopped");
    });

    it("stops a draft that runs past the time limit", async () => {
      await server.close();
      server = buildServer({
        adminOrigin: "http://localhost:5173",
        database: testDatabase.activeDatabase,
        publicApiUrl: "http://api.test",
        pageDrafts: {
          modelsFolder: folder,
          model: repository.model(),
          runner,
          timeLimitMs: 20,
          freeMemoryInBytes: () => freeMemory,
        },
      });
      await server.ready();
      admin = await signInAndGetCookies(server, "admin@example.com");
      await install();
      runner.waitForStop = true;
      const started = (await request("POST", "/drafts/page", { purpose: "A bakery" })).json();
      const job = await finishedJob(started.id);
      expect(job.state).toBe("failed");
      expect(job.problem).toMatch(/took too long/);
    });

    it("won't load the model without enough free memory", async () => {
      await install();
      freeMemory = 2 * GIGABYTE;
      const response = await request("POST", "/drafts/page", { purpose: "A bakery" });
      expect(response.statusCode).toBe(503);
      expect(response.json().code).toBe("NOT_ENOUGH_MEMORY");
      expect(runner.write).not.toHaveBeenCalled();
    });

    it("rewrites a piece of text", async () => {
      await install();
      runner.answer = JSON.stringify({ text: "Fresh bread, every morning." });
      const started = await request("POST", "/drafts/rewrite", {
        text: "We bake fresh bread every single morning of the week.",
        style: "shorter",
      });
      const job = await finishedJob(started.json().id);
      expect(job.result).toEqual({ text: "Fresh bread, every morning." });
      expect(runner.asked[0]?.request.prompt).toMatch(/^Make it shorter/);
    });
  });

  describe("who may draft", () => {
    it("needs drafts:use, which editors and admins have and authors don't", async () => {
      const permissionsOf = (handle: string) =>
        builtInRoles.find((role) => role.handle === handle)?.permissions ?? [];
      expect(hasPermission(permissionsOf("editor"), "drafts:use")).toBe(true);
      expect(hasPermission(permissionsOf("admin"), "drafts:use")).toBe(true);
      expect(hasPermission(permissionsOf("author"), "drafts:use")).toBe(false);
      await createTestUser(testDatabase.database, "author@example.com", [["entries:read"]]);
      const author = await signInAndGetCookies(server, "author@example.com");
      const response = await request("POST", "/drafts/page", { purpose: "A bakery" }, author);
      expect(response.statusCode).toBe(403);
      expect((await request("GET", "/drafts/model", undefined, author)).statusCode).toBe(403);
    });

    it("shows a draft only to the person who asked for it", async () => {
      await install();
      runner.answer = JSON.stringify(goodPlan);
      const started = (await request("POST", "/drafts/page", { purpose: "A bakery" })).json();
      await createTestUser(testDatabase.database, "editor@example.com", [["drafts:use"]]);
      const editor = await signInAndGetCookies(server, "editor@example.com");
      await server.pageDrafts.desk.settled();
      const response = await request("GET", `/drafts/jobs/${started.id}`, undefined, editor);
      expect(response.statusCode).toBe(404);
    });
  });
});
