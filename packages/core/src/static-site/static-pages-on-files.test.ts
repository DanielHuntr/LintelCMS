import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type NodeBlueprint,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { describe, expect, it } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import { useStaticSiteTestServer } from "../testing/test-static-site.js";
import { findSiteFiles, readSiteFile } from "./static-assets.js";
import { exportStaticSite } from "./static-export.service.js";
import { hasLiveShopElements, pointFormsAt } from "./static-pages-on-files.js";

const companion = {
  action: (handle: string) => `/lintel-bridge.php?action=form&form=${handle}`,
  tokenUrl: (handle: string) => `/lintel-bridge.php?action=token&form=${handle}`,
};

function design(...blueprints: NodeBlueprint[]): PageDocument {
  const createId = createCountingNodeIds("d");
  const page = createEmptyPage();
  const section = createNode(
    { type: "section", children: blueprints },
    standardCatalogue,
    createId,
  );
  return { ...page, root: { ...page.root, children: [section] } };
}

describe("pages as files", () => {
  it("points builder forms at the companion and fetches a fresh token", () => {
    const html =
      '<html><body><form id="f" action="/_lintel/api/forms/contact_us/submissions" method="post"><input name="_token" value="old"></form></body></html>';
    const pointed = pointFormsAt(html, companion);

    expect(pointed).toContain(
      'action="/lintel-bridge.php?action=form&amp;form=contact_us" data-lintel-token-url="/lintel-bridge.php?action=token&amp;form=contact_us"',
    );
    expect(pointed).toContain('<script src="/_lintel/forms.js" defer></script></body>');
    expect(pointFormsAt(pointed, companion)).toBe(pointed);
    expect(pointFormsAt("<p>No forms</p>", companion)).toBe("<p>No forms</p>");
    expect(pointed).not.toContain("data-plain-post");
    expect(pointFormsAt(html, { ...companion, plainPost: true })).toContain("data-plain-post");
  });

  it("knows which pages have shop elements that need a running Lintel", () => {
    expect(hasLiveShopElements('<form data-behaviour="add-to-cart">')).toBe(true);
    expect(hasLiveShopElements('<div data-behaviour="carousel">')).toBe(false);
  });

  it("finds the website's own files, but not Lintel's API", () => {
    expect(
      findSiteFiles(
        'src="/_lintel/elements-abc.js" url(/_lintel/fonts/inter-latin-400-normal.woff2) src="/_lintel/api/analytics/script.js"',
      ),
    ).toEqual(["/_lintel/elements-abc.js", "/_lintel/fonts/inter-latin-400-normal.woff2"]);
    expect(readSiteFile("/_lintel/fonts/inter-latin-400-normal.woff2")).not.toBeNull();
    // A 3D model named in a page's effect settings (LINTEL-UX-318).
    expect(findSiteFiles('{"src":"/_lintel/models/vase.glb"}')).toEqual([
      "/_lintel/models/vase.glb",
    ]);
    expect(readSiteFile("/_lintel/models/vase.glb")?.content.length).toBeGreaterThan(0);
    expect(readSiteFile("/_lintel/models/not-a-model.glb")).toBeNull();
    expect(readSiteFile("/_lintel/fonts/not-a-font.woff2")).toBeNull();
    expect(readSiteFile("/_lintel/illustrations/../secret.svg")).toBeNull();
  });
});

describe("exporting designed pages", { timeout: 60_000 }, () => {
  const testDatabase = useTestDatabase();
  const lintel = useStaticSiteTestServer(testDatabase);

  it("copies the fonts the stylesheet names and points a designed form at the companion", async () => {
    const form = await lintel.createForm("Contact us");
    await lintel.publish("pages", { title: "Home" }, "home");
    await lintel.publish(
      "pages",
      {
        title: "Get in touch",
        design: design(
          { type: "heading", props: { text: "Say hello", level: 2 } },
          { type: "formEmbed", props: { form: form.handle } },
        ),
      },
      "get-in-touch",
    );
    const folder = join(lintel.folder, "site");
    const result = await exportStaticSite({ api: lintel.api, folder, formEndpoints: companion });

    const page = readFileSync(join(folder, "get-in-touch", "index.html"), "utf8");
    expect(page).toContain("Say hello");
    expect(page).toContain(`action="/lintel-bridge.php?action=form&amp;form=${form.handle}"`);
    expect(page).not.toContain("/_lintel/api/forms");
    expect(page).not.toContain("/_lintel/api/analytics");
    for (const file of findSiteFiles(page)) {
      expect(existsSync(join(folder, file)), file).toBe(true);
    }
    const stylesheet = Object.keys(result.files).find((file) => /^_lintel\/site-/.test(file));
    const css = readFileSync(join(folder, stylesheet ?? ""), "utf8");
    const fonts = findSiteFiles(css).filter((file) => file.startsWith("/_lintel/fonts/"));
    expect(fonts.length).toBeGreaterThan(0);
    for (const font of fonts) {
      expect(existsSync(join(folder, font)), font).toBe(true);
    }

    // Nothing changed: nothing drawn again, and the fonts are kept.
    const again = await exportStaticSite({ api: lintel.api, folder, formEndpoints: companion });
    expect(again.rebuilt).toEqual([]);
    expect(again.files).toEqual(result.files);
  });
});
