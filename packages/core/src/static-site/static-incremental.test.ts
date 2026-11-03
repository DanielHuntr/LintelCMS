import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import { exportStaticSite } from "./static-export.service.js";
import { useStaticSiteTestServer } from "../testing/test-static-site.js";

describe("exporting again", { timeout: 60_000 }, () => {
  const testDatabase = useTestDatabase();
  const lintel = useStaticSiteTestServer(testDatabase);

  async function exportSite() {
    return exportStaticSite({ api: lintel.api, folder: join(lintel.folder, "site") });
  }

  async function sampleSite() {
    // The first page at the top of the page tree is the site's start, shown at "/".
    await lintel.publish("pages", { title: "Home" }, "home");
    const about = await lintel.publish("pages", { title: "About us" }, "about");
    await lintel.publish("pages", { title: "Contact" }, "contact");
    const first = await lintel.publish("posts", { title: "First bake" }, "first-bake");
    await lintel.publish("posts", { title: "Second bake" }, "second-bake");
    return { first, about };
  }

  it("rebuilds nothing when nothing changed", async () => {
    await sampleSite();
    const first = await exportSite();
    expect(first.rebuilt).toContain("/about");
    const second = await exportSite();
    expect(second.rebuilt).toEqual([]);
    expect(second.unchanged).toEqual(
      expect.arrayContaining(["/about", "/blog", "/blog/first-bake"]),
    );
    expect(second.files).toEqual(first.files);
  });

  it("rebuilds a changed post and the pages that list it, and nothing else", async () => {
    const { first } = await sampleSite();
    await exportSite();
    await lintel.republish(first, { title: "First bake, improved" });

    const again = await exportSite();
    expect(again.rebuilt).toEqual(
      expect.arrayContaining(["/blog/first-bake", "/blog", "/blog/feed.xml", "/sitemap.xml"]),
    );
    expect(again.rebuilt).not.toContain("/about");
    expect(again.rebuilt).not.toContain("/contact");
    expect(again.rebuilt).not.toContain("/blog/second-bake");
  });

  it("rebuilds every page when the menu, shown on every page, changes", async () => {
    await sampleSite();
    await exportSite();
    const saved = await lintel.send("PUT", "/navigation/main", {
      items: [{ id: "6a0e4bb8-0f9e-4f3b-8a43-5d5c3b1f2a10", label: "Visit us", url: "/contact" }],
    });
    expect(saved.statusCode, saved.body).toBe(200);

    const again = await exportSite();
    expect(again.rebuilt).toEqual(
      expect.arrayContaining(["/about", "/contact", "/blog/first-bake"]),
    );
    expect(again.unchanged).toEqual([]);
  });

  it("removes the files of an unpublished page, and repairs a file changed by hand", async () => {
    const { about } = await sampleSite();
    await exportSite();
    expect((await lintel.send("POST", `/entries/${about}/unpublish`)).statusCode).toBe(200);
    writeFileSync(join(lintel.folder, "site", "contact", "index.html"), "changed by hand");

    const again = await exportSite();
    expect(again.removed).toContain("about/index.html");
    expect(existsSync(join(lintel.folder, "site", "about", "index.html"))).toBe(false);
    expect(again.rebuilt).toContain("/contact");
  });
});
