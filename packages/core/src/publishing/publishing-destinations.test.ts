import { mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "../server.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { checkFolderIsSafe, checkRemoteAddress } from "./destination-safety.js";
import { publishTargetsTable } from "./publishing.table.js";

const RULES = { allowPrivateAddresses: false, lintelFolders: [] };

describe("where a live site may publish", () => {
  const testDatabase = useTestDatabase();
  let folder: string;
  let server: FastifyInstance;
  let owner: SendRequest;
  let admin: SendRequest;

  async function start(publicApiUrl: string) {
    server = buildServer({
      adminOrigin: "http://localhost:5173",
      database: testDatabase.activeDatabase,
      publicApiUrl,
      runScheduledJobs: false,
      lintelFolder: {
        dataFolder: join(folder, "lintel", "data"),
        configFile: join(folder, "lintel", "config.json"),
      },
    });
    await server.ready();
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    await createTestUser(testDatabase.database, "admin@example.com", [["settings:*"]]);
    owner = requestsAs(server, await signInAndGetCookies(server, "owner@example.com"));
    admin = requestsAs(server, await signInAndGetCookies(server, "admin@example.com"));
  }

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-destinations-"));
  });

  afterEach(async () => {
    await server.close();
    await rm(folder, { recursive: true, force: true });
  });

  async function waitForRunToFinish(url: string) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const [run] = (await owner("GET", `${url}/runs`)).json().runs as Array<{ status: string }>;
      if (run && run.status !== "running") return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("The publish never finished.");
  }

  const ftpTo = (host: string) => ({
    name: "Hosting",
    kind: "ftp",
    options: { host, username: "me" },
    secrets: { password: "pw" },
  });

  it("refuses private and local addresses", async () => {
    await start("https://cms.example.com");
    const refused = [
      ftpTo("127.0.0.1"),
      ftpTo("169.254.169.254"),
      ftpTo("localhost"),
      ftpTo("nas.local"),
      ftpTo("[fd00::1]"),
      {
        name: "Bucket",
        kind: "s3",
        options: { bucket: "b", region: "eu", endpoint: "http://169.254.169.254/latest" },
      },
      { name: "Site", kind: "zip", options: { siteAddress: "http://10.0.0.8" } },
    ];
    for (const target of refused) {
      const response = await owner("POST", "/publishing/targets", target);
      expect(response.statusCode, JSON.stringify(target)).toBe(400);
      expect(response.json().code).toBe("PRIVATE_DESTINATION");
    }
    expect((await owner("POST", "/publishing/targets", ftpTo("203.0.114.9"))).statusCode).toBe(201);
  });

  it("refuses them on a change, and on a destination saved before", async () => {
    await start("https://cms.example.com");
    const created = await owner("POST", "/publishing/targets", ftpTo("203.0.114.9"));
    const url = `/publishing/targets/${created.json().id as string}`;
    const changed = await owner("PATCH", url, { options: { host: "10.1.1.1" } });
    expect(changed.statusCode).toBe(400);

    await testDatabase.database
      .update(publishTargetsTable)
      .set({ options: { host: "10.1.1.1", username: "me" } });
    const tested = await owner("POST", `${url}/test`);
    expect(tested.json().code).toBe("PRIVATE_DESTINATION");
    const published = await owner("POST", `${url}/publish`, {});
    expect(published.statusCode).toBe(202);
    await waitForRunToFinish(url);
    const [run] = (await owner("GET", `${url}/runs`)).json().runs;
    expect(run.status).toBe("failed");
    expect(run.errorMessage).toContain("private or local");
  });

  it("allows them when the site itself is on a local address", async () => {
    await start("http://localhost:4000");
    expect((await owner("POST", "/publishing/targets", ftpTo("192.168.1.20"))).statusCode).toBe(
      201,
    );
  });

  it("looks at what a name resolves to", async () => {
    const pointsInside = async () => ["10.0.0.5"];
    await expect(checkRemoteAddress("sneaky.example", RULES, pointsInside)).rejects.toThrow(
      /private or local/,
    );
    const pointsOutside = async () => ["203.0.114.9"];
    await expect(
      checkRemoteAddress("ftp.example.com", RULES, pointsOutside),
    ).resolves.toBeUndefined();
    const doesntResolve = async () => {
      throw new Error("not found");
    };
    await expect(checkRemoteAddress("typo.example", RULES, doesntResolve)).resolves.toBeUndefined();
  });

  describe("a folder on this server", () => {
    const toFolder = (folderPath: string) => ({
      name: "Folder",
      kind: "folder",
      options: { folderPath },
    });

    it("is only for owners", async () => {
      await start("https://cms.example.com");
      const path = join(folder, "www", "site");
      expect((await admin("POST", "/publishing/targets", toFolder(path))).statusCode).toBe(403);

      const created = await owner("POST", "/publishing/targets", toFolder(path));
      expect(created.statusCode, created.body).toBe(201);
      const url = `/publishing/targets/${created.json().id as string}`;
      expect((await admin("PATCH", url, { name: "Mine" })).statusCode).toBe(403);
      expect((await admin("POST", `${url}/test`)).statusCode).toBe(403);
      expect((await admin("POST", `${url}/publish`, {})).statusCode).toBe(403);
      expect((await admin("DELETE", url)).statusCode).toBe(403);
      expect((await admin("GET", url)).statusCode).toBe(200);
    });

    it("refuses Lintel's own folders", async () => {
      await start("https://cms.example.com");
      for (const path of [
        join(folder, "lintel"),
        join(folder, "lintel", "data", "uploads"),
        folder,
      ]) {
        const response = await owner("POST", "/publishing/targets", toFolder(path));
        expect(response.statusCode, path).toBe(400);
        expect(response.json().code).toBe("UNSAFE_FOLDER");
      }
    });

    it("refuses system locations on Linux and Windows", async () => {
      const linux = ["/", "/etc", "/etc/nginx", "/usr/local/bin", "/var/lib/x", "/root/site"];
      for (const path of linux) {
        await expect(checkFolderIsSafe(path, RULES, "linux"), path).rejects.toThrow(
          /can't publish/,
        );
      }
      await expect(checkFolderIsSafe("/var/www/site", RULES, "linux")).resolves.toBeUndefined();

      const windows = ["C:\\", "C:\\Windows\\System32", "c:\\program files\\x", "D:\\"];
      for (const path of windows) {
        await expect(checkFolderIsSafe(path, RULES, "win32"), path).rejects.toThrow(
          /can't publish/,
        );
      }
      await expect(checkFolderIsSafe("D:\\www\\site", RULES, "win32")).resolves.toBeUndefined();
      await expect(checkFolderIsSafe(homedir(), RULES)).rejects.toThrow(/can't publish/);
      await expect(checkFolderIsSafe(join(homedir(), ".ssh"), RULES)).rejects.toThrow(
        /can't publish/,
      );
    });
  });
});
