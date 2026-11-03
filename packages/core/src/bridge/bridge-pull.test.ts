import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startPublish } from "../publishing/publish-runs.service.js";
import { useTestDatabase } from "../testing/test-database.js";
import { useStaticSiteTestServer } from "../testing/test-static-site.js";
import { hmacHex } from "./bridge-signing.js";
import { pullFromBridge } from "./bridge-pull.service.js";
import { findPublishTargetRow, readSecrets } from "../publishing/publishing.service.js";

const hasPhp = (() => {
  try {
    execFileSync("php", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasPhp)("collecting from a published site", { timeout: 120_000 }, () => {
  const testDatabase = useTestDatabase();
  const lintel = useStaticSiteTestServer(testDatabase);
  let php: ChildProcess | undefined;

  afterEach(() => {
    php?.kill();
  });

  it("brings a form sent to the published site into Forms, once", async () => {
    const form = await lintel.createForm("Contact us");
    await lintel.publish("pages", { title: "Home" }, "home");
    const folder = join(lintel.folder, "public_html");
    mkdirSync(folder, { recursive: true });
    const port = 19_000 + Math.floor(Math.random() * 1_000);
    const siteAddress = `http://127.0.0.1:${port}`;
    php = spawn("php", ["-S", `127.0.0.1:${port}`, "-t", folder], { stdio: "ignore" });

    const created = await lintel.send("POST", "/publishing/targets", {
      name: "Shared hosting",
      kind: "folder",
      options: { folderPath: folder, siteAddress },
    });
    const targetId = (created.json() as { id: string }).id;
    const run = await (
      await startPublish(lintel.api.publishing, targetId, { trigger: "manual" })
    ).finished;
    expect(run.status, run.errorMessage ?? "").toBe("succeeded");

    const target = await findPublishTargetRow(testDatabase.database, targetId);
    const secret = readSecrets(lintel.api.publishing.secretBox(), target).bridgeSecret ?? "";
    const opened = String(Math.floor(Date.now() / 1000) - 60);
    const sent = await fetch(`${siteAddress}/lintel-bridge.php?action=form&form=${form.handle}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        _token: `${opened}.${hmacHex(secret, `form:${form.handle}.${opened}`)}`,
        name: "Sam Rivera",
        email: "sam@example.com",
        message: "Do you make rye bread?",
        consent: "yes",
      }).toString(),
    });
    expect(sent.status, await sent.clone().text()).toBe(201);

    const first = await pullFromBridge(lintel.api, target, secret);
    expect(first.submissions).toBe(1);
    const second = await pullFromBridge(lintel.api, target, secret);
    expect(second.submissions).toBe(0);

    const inbox = await lintel.send("GET", `/forms/${form.id}/submissions`);
    const submissions = (
      inbox.json() as { submissions: Array<{ values: Record<string, unknown> }> }
    ).submissions;
    expect(submissions).toHaveLength(1);
    expect(submissions[0]?.values.message).toBe("Do you make rye bread?");
  });
});
