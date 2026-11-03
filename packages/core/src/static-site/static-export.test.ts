import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import { exportStaticSite } from "./static-export.service.js";
import { STATIC_TEST_API_URL, useStaticSiteTestServer } from "../testing/test-static-site.js";

describe("exporting the website as files", { timeout: 60_000 }, () => {
  const testDatabase = useTestDatabase();
  const lintel = useStaticSiteTestServer(testDatabase);

  async function sampleSite() {
    const photo = await lintel.uploadPhoto();
    const form = await lintel.createForm("Contact us");
    await lintel.publish(
      "pages",
      {
        title: "Home",
        hero_image: photo,
        sections: [
          {
            id: "0b6c1b1e-0d3e-4c1e-9f00-000000000001",
            type: "hero",
            data: { heading: "Bread worth getting up for", image: photo },
          },
        ],
      },
      "home",
    );
    await lintel.publish(
      "pages",
      {
        title: "Contact",
        sections: [
          {
            id: "0b6c1b1e-0d3e-4c1e-9f00-000000000002",
            type: "form",
            data: { heading: "Say hello", form: form.handle },
          },
        ],
      },
      "contact",
    );
    for (let number = 1; number <= 12; number += 1) {
      await lintel.publish("posts", { title: `Bake number ${number}` }, `bake-${number}`);
    }
    return { photo, form };
  }

  function exported(file: string) {
    return readFileSync(join(lintel.folder, "site", file), "utf8");
  }

  it("draws every page with the live site's own HTML, pictures copied in", async () => {
    const { photo } = await sampleSite();
    const result = await exportStaticSite({ api: lintel.api, folder: join(lintel.folder, "site") });
    expect(result.warnings).toEqual([]);

    for (const [path, file] of [
      ["/", "index.html"],
      ["/contact", "contact/index.html"],
      ["/blog", "blog/index.html"],
      ["/blog/page/2", "blog/page/2/index.html"],
      ["/blog/bake-3", "blog/bake-3/index.html"],
    ] as const) {
      const live = await lintel.site.inject({ method: "GET", url: path });
      expect(live.statusCode).toBe(200);
      const savedMedia = new Map(
        Object.keys(result.files)
          .filter((name) => name.startsWith(`media/${photo}/`))
          .map((name) => [name, name] as const),
      );
      // The only difference: links to the media server point at the copies.
      const expected = live.body.replace(
        new RegExp(`${STATIC_TEST_API_URL}/media/${photo}/file\\?[^"\\s,]*`, "g"),
        (address) => {
          const parameters = new URLSearchParams(address.split("?")[1]?.replace(/&amp;/g, "&"));
          const width = parameters.get("w");
          const height = parameters.get("h");
          const stem = `media/${photo}/${parameters.get("v")}${width || height ? `-${width ?? "auto"}x${height ?? "auto"}-${parameters.get("fit") ?? "cover"}` : ""}.`;
          const file = [...savedMedia.keys()].find((name) => name.startsWith(stem)) ?? "missing";
          return `/${file}`;
        },
      );
      expect(exported(file)).toBe(
        expected.replace(/content="\/media\//g, 'content="https://www.example.com/media/'),
      );
    }
    expect(exported("index.html")).toContain(`/media/${photo}/`);
    expect(exported("index.html")).not.toContain(`${STATIC_TEST_API_URL}/media`);
    const variants = Object.keys(result.files).filter((name) => name.endsWith(".webp"));
    expect(variants.length).toBeGreaterThan(1);
  });

  it("writes the 404 page, search engine files, the feed, search, and server settings", async () => {
    await sampleSite();
    const result = await exportStaticSite({ api: lintel.api, folder: join(lintel.folder, "site") });
    const files = Object.keys(result.files);

    expect(exported("404.html")).toContain("We couldn’t find that page");
    expect(exported("sitemap.xml")).toContain("<loc>https://www.example.com/blog/bake-1</loc>");
    expect(exported("robots.txt")).toContain("Sitemap: https://www.example.com/sitemap.xml");
    expect(exported("blog/feed.xml")).toContain("<title>Bake number 12</title>");
    expect(exported("_lintel/search-index.json")).toContain("Bake number 7");
    expect(exported("search/index.html")).toContain("data-lintel-search");
    expect(exported(".htaccess")).toContain("ErrorDocument 404 /404.html");
    expect(exported("web.config")).toContain('<error statusCode="404" path="/404.html"');
    expect(files.some((file) => /^_lintel\/site-[0-9a-f]+\.css$/.test(file))).toBe(true);
    expect(exported("_lintel/forms.js")).toContain("data-lintel-token-url");
    expect(existsSync(join(lintel.folder, "site", ".lintel-manifest.json"))).toBe(true);
  });

  it("draws forms as plain HTML that posts where it is told", async () => {
    const { form } = await sampleSite();
    await exportStaticSite({
      api: lintel.api,
      folder: join(lintel.folder, "site"),
      formEndpoints: {
        action: (handle) => `/lintel-bridge.php?form=${handle}`,
        tokenUrl: (handle) => `/lintel-bridge.php?token=${handle}`,
      },
    });
    const page = exported("contact/index.html");
    expect(page).toContain(`action="/lintel-bridge.php?form=${form.handle}"`);
    expect(page).toContain('name="_website"');
    expect(page).toContain('<label class="lintel-site-form__label" for=');
    expect(page).toContain('<script src="/_lintel/forms.js" defer="">');
  });

  it("writes the SEO plugin's redirects as pages and server rules", async () => {
    await sampleSite();
    const created = await lintel.send("POST", "/seo/redirects", {
      fromPath: "/old-contact",
      toPath: "/contact",
      statusCode: 301,
    });
    expect(created.statusCode, created.body).toBe(201);
    await exportStaticSite({ api: lintel.api, folder: join(lintel.folder, "site") });
    expect(exported("old-contact/index.html")).toContain('content="0; url=/contact"');
    expect(exported(".htaccess")).toContain("RewriteRule ^old-contact/?$ /contact [R=301,L]");
  });
});
