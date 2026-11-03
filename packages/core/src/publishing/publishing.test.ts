import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { startFakeSftpServer } from "../testing/fake-sftp-server.js";
import { useTestDatabase } from "../testing/test-database.js";
import { useStaticSiteTestServer } from "../testing/test-static-site.js";
import { startPublish } from "./publish-runs.service.js";
import { publishTargetsTable } from "./publishing.table.js";

describe("publishing the website", { timeout: 120_000 }, () => {
  const testDatabase = useTestDatabase();
  const lintel = useStaticSiteTestServer(testDatabase);

  async function addTarget(body: Record<string, unknown>) {
    const created = await lintel.send("POST", "/publishing/targets", body);
    expect(created.statusCode, created.body).toBe(201);
    return created.json() as { id: string; saved: Record<string, boolean>; warnings: string[] };
  }

  async function publishAndWait(targetId: string, options: { confirmDeletions?: boolean } = {}) {
    const started = await startPublish(lintel.api.publishing, targetId, {
      trigger: "manual",
      ...options,
    });
    return started.finished;
  }

  async function sampleSite() {
    await lintel.publish("pages", { title: "Home" }, "home");
    const about = await lintel.publish("pages", { title: "About us" }, "about");
    return { about };
  }

  it("keeps passwords to itself and warns about plain FTP", async () => {
    const target = await addTarget({
      name: "Old host",
      kind: "ftp",
      options: { host: "ftp.example.com", username: "me", ftpSecurity: "none" },
      secrets: { password: "hunter2-but-longer" },
    });
    expect(target.saved.password).toBe(true);
    expect(target.warnings.join(" ")).toContain("Plain FTP sends your password");
    const listed = await lintel.send("GET", "/publishing/targets");
    expect(listed.body).not.toContain("hunter2");
    const stored = await testDatabase.database.select().from(publishTargetsTable);
    expect(JSON.stringify(stored)).not.toContain("hunter2");
  });

  it("publishes to a folder, then uploads only what changed and removes what went", async () => {
    const { about } = await sampleSite();
    const folder = join(lintel.folder, "public_html");
    const target = await addTarget({
      name: "This server",
      kind: "folder",
      options: { folderPath: folder },
    });

    const first = await publishAndWait(target.id);
    expect(first.status, first.errorMessage ?? "").toBe("succeeded");
    expect(readFileSync(join(folder, "about", "index.html"), "utf8")).toContain("About us");
    expect(existsSync(join(folder, "lintel-bridge.php"))).toBe(true);
    // The companion's settings go beside the website, not inside it.
    expect(existsSync(join(lintel.folder, "lintel-private", "config.php"))).toBe(true);
    expect(existsSync(join(folder, "lintel-private"))).toBe(false);

    const second = await publishAndWait(target.id);
    expect(second.summary?.uploadedCount).toBe(0);

    await lintel.send("POST", `/entries/${about}/unpublish`);
    const third = await publishAndWait(target.id);
    expect(third.summary?.deleted).toContain("about/index.html");
    expect(existsSync(join(folder, "about", "index.html"))).toBe(false);

    const history = await lintel.send("GET", `/publishing/targets/${target.id}/runs`);
    expect((history.json() as { runs: unknown[] }).runs).toHaveLength(3);
  });

  it("holds back more deletions than the limit until someone confirms", async () => {
    const { about } = await sampleSite();
    const folder = join(lintel.folder, "public_html");
    const target = await addTarget({
      name: "Careful",
      kind: "folder",
      options: { folderPath: folder },
      deleteLimit: 0,
    });
    await publishAndWait(target.id);
    await lintel.send("POST", `/entries/${about}/unpublish`);

    const held = await publishAndWait(target.id);
    expect(held.status).toBe("needsConfirmation");
    expect(held.summary?.deletionsWaiting).toBeGreaterThan(0);
    expect(existsSync(join(folder, "about", "index.html"))).toBe(true);

    const confirmed = await publishAndWait(target.id, { confirmDeletions: true });
    expect(confirmed.status).toBe("succeeded");
    expect(existsSync(join(folder, "about", "index.html"))).toBe(false);
  });

  it("publishes over SFTP, renaming each upload into place, with the same delete limit", async () => {
    const { about } = await sampleSite();
    const remoteRoot = join(lintel.folder, "sftp-home");
    mkdirSync(remoteRoot, { recursive: true });
    const sftp = await startFakeSftpServer({
      folder: remoteRoot,
      username: "baker",
      password: "correct-horse",
    });
    try {
      const target = await addTarget({
        name: "VPS",
        kind: "sftp",
        options: {
          host: "127.0.0.1",
          port: sftp.port,
          username: "baker",
          remoteFolder: "public_html",
        },
        secrets: { password: "correct-horse" },
        deleteLimit: 0,
      });
      const tested = await lintel.send("POST", `/publishing/targets/${target.id}/test`);
      expect(tested.statusCode, tested.body).toBe(200);

      const first = await publishAndWait(target.id);
      expect(first.status, first.errorMessage ?? "").toBe("succeeded");
      expect(
        readFileSync(join(remoteRoot, "public_html", "about", "index.html"), "utf8"),
      ).toContain("About us");
      expect(existsSync(join(remoteRoot, "lintel-private", "config.php"))).toBe(true);

      await lintel.send("POST", `/entries/${about}/unpublish`);
      expect((await publishAndWait(target.id)).status).toBe("needsConfirmation");
      expect((await publishAndWait(target.id, { confirmDeletions: true })).status).toBe(
        "succeeded",
      );
      expect(existsSync(join(remoteRoot, "public_html", "about", "index.html"))).toBe(false);

      await lintel.send("PATCH", `/publishing/targets/${target.id}`, {
        secrets: { password: "wrong" },
      });
      const refused = await lintel.send("POST", `/publishing/targets/${target.id}/test`);
      expect(refused.statusCode).toBe(502);
      expect(refused.json().message).toContain("turned down the username, password or key");
    } finally {
      await sftp.close();
    }
  });

  it("publishes over FTPS (explicit TLS), with the same delete limit", async () => {
    const { about } = await sampleSite();
    const remoteRoot = join(lintel.folder, "ftp-home");
    mkdirSync(remoteRoot, { recursive: true });
    const ftp = await startFtpServer(remoteRoot, lintel.folder);
    try {
      lintel.api.publishing.allowSelfSignedCertificates = true;
      const target = await addTarget({
        name: "cPanel",
        kind: "ftp",
        options: {
          host: "127.0.0.1",
          port: ftp.port,
          username: "baker",
          remoteFolder: "public_html",
        },
        secrets: { password: "correct-horse" },
        deleteLimit: 0,
      });
      const first = await publishAndWait(target.id);
      expect(first.status, first.errorMessage ?? "").toBe("succeeded");
      expect(
        readFileSync(join(remoteRoot, "public_html", "about", "index.html"), "utf8"),
      ).toContain("About us");

      await lintel.send("POST", `/entries/${about}/unpublish`);
      expect((await publishAndWait(target.id)).status).toBe("needsConfirmation");
      expect(existsSync(join(remoteRoot, "public_html", "about", "index.html"))).toBe(true);
      expect((await publishAndWait(target.id, { confirmDeletions: true })).status).toBe(
        "succeeded",
      );
      expect(existsSync(join(remoteRoot, "public_html", "about", "index.html"))).toBe(false);
    } finally {
      await ftp.close();
    }
  });

  it("downloads the website as a ZIP with the private folder kept apart", async () => {
    await sampleSite();
    const target = await addTarget({ name: "By hand", kind: "zip" });
    const download = await lintel.send("GET", `/publishing/targets/${target.id}/download`);
    expect(download.statusCode, download.body).toBe(200);
    expect(download.headers["content-type"]).toBe("application/zip");
    const names = download.rawPayload.toString("latin1");
    expect(names).toContain("website/about/index.html");
    expect(names).toContain("lintel-private/config.php");
  });
});

/** ftp-srv with a self-signed certificate made by openssl, for explicit TLS. */
async function startFtpServer(root: string, scratch: string) {
  const { FtpSrv } = await import("ftp-srv");
  const key = join(scratch, "ftp.key");
  const cert = join(scratch, "ftp.crt");
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      key,
      "-out",
      cert,
      "-days",
      "1",
      "-subj",
      "/CN=127.0.0.1",
    ],
    { stdio: "ignore" },
  );
  const port = 21_000 + Math.floor(Math.random() * 2_000);
  // ftp-srv logs every command through bunyan; a logger that says nothing keeps output readable.
  const quiet = {
    child: () => quiet,
    trace() {},
    debug() {},
    info() {},
    warn() {},
    error() {},
    fatal() {},
  };
  const server = new FtpSrv({
    log: quiet,
    url: `ftp://127.0.0.1:${port}`,
    pasv_url: "127.0.0.1",
    pasv_min: port + 1,
    pasv_max: port + 50,
    anonymous: false,
    tls: { key: readFileSync(key), cert: readFileSync(cert) },
  });
  server.on("login", ({ username, password }, resolve, reject) => {
    if (username === "baker" && password === "correct-horse") resolve({ root });
    else reject(new Error("530 Login incorrect"));
  });
  await server.listen();
  return { port, close: () => server.close() };
}
