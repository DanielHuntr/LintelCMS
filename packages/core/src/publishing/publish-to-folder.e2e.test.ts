import { mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";
import { afterEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import { useStaticSiteTestServer } from "../testing/test-static-site.js";
import { startPublish } from "./publish-runs.service.js";

/**
 * The whole journey: make a page with a form, publish it to a folder, serve that folder
 * with a plain static file server (no Lintel, no PHP) and look at it in a real browser.
 */

const SCREENSHOTS = process.env.LINTEL_SCREENSHOTS_FOLDER;

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".webp": "image/webp",
  ".json": "application/json",
};

function serveFolder(folder: string): Promise<Server> {
  const server = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? "/").split("?")[0] ?? "/");
    const file = normalize(join(folder, path.endsWith("/") ? `${path}index.html` : path));
    readFile(file)
      .catch(() => readFile(join(file, "index.html")))
      .then(
        (body) => {
          response.setHeader("content-type", types[extname(file)] ?? "text/html; charset=utf-8");
          response.end(body);
        },
        async () => {
          response.statusCode = 404;
          response.setHeader("content-type", "text/html; charset=utf-8");
          response.end(await readFile(join(folder, "404.html")).catch(() => "Not found"));
        },
      );
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

describe("publishing to a folder, end to end", { timeout: 180_000 }, () => {
  const testDatabase = useTestDatabase();
  const lintel = useStaticSiteTestServer(testDatabase);
  let staticServer: Server | undefined;

  afterEach(async () => {
    await new Promise<void>((resolve) =>
      staticServer ? staticServer.close(() => resolve()) : resolve(),
    );
  });

  it("shows the published page and its form from plain files", async () => {
    const form = await lintel.createForm("Contact us");
    await lintel.publish("pages", { title: "Home" }, "home");
    await lintel.publish(
      "pages",
      {
        title: "Visit the bakery",
        summary: "Where to find us",
        sections: [
          {
            id: "0b6c1b1e-0d3e-4c1e-9f00-000000000010",
            type: "form",
            data: { heading: "Ask us anything", form: form.handle },
          },
        ],
      },
      "visit",
    );
    const folder = join(lintel.folder, "public_html");
    mkdirSync(folder, { recursive: true });
    staticServer = await serveFolder(folder);
    const address = `http://127.0.0.1:${(staticServer.address() as AddressInfo).port}`;

    const created = await lintel.send("POST", "/publishing/targets", {
      name: "This server",
      kind: "folder",
      options: { folderPath: folder, siteAddress: address },
    });
    expect(created.statusCode, created.body).toBe(201);
    const run = await (
      await startPublish(lintel.api.publishing, created.json().id, { trigger: "manual" })
    ).finished;
    expect(run.status, run.errorMessage ?? "").toBe("succeeded");

    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
      const response = await page.goto(`${address}/visit/`);
      expect(response?.status()).toBe(200);
      await expect.poll(() => page.title()).toBe("Visit the bakery | Corner Bakery");
      expect(await page.getByRole("heading", { name: "Ask us anything" }).isVisible()).toBe(true);
      expect(await page.getByLabel("Email").isVisible()).toBe(true);
      expect(await page.getByRole("button", { name: "Send message" }).isVisible()).toBe(true);
      const action = await page.locator("form[data-lintel-form]").getAttribute("action");
      expect(action).toBe(`/lintel-bridge.php?action=form&form=${form.handle}`);
      // The stylesheet came from the published files too.
      const background = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
      expect(background).not.toBe("");
      if (SCREENSHOTS) {
        mkdirSync(SCREENSHOTS, { recursive: true });
        await page.screenshot({
          path: join(SCREENSHOTS, "published-page-with-form.png"),
          fullPage: true,
        });
      }
      const missing = await page.goto(`${address}/no-such-page/`);
      expect(missing?.status()).toBe(404);
      expect(await page.getByText("We couldn’t find that page").isVisible()).toBe(true);
    } finally {
      await browser.close();
    }
  });
});
