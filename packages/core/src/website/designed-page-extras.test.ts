import { createEmptyPage, type PageDocument } from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { acceptAnyAsset } from "../fieldtypes/image-assets.js";
import { useTestDatabase } from "../testing/test-database.js";
import { startTestServer } from "../testing/test-server.js";
import { readPageDesign } from "./designed-pages.js";
import { buildSiteServer } from "./site-server.js";

function designWithFontAndVideo(): PageDocument {
  const page = createEmptyPage();
  return {
    ...page,
    root: {
      ...page.root,
      props: { fonts: [{ source: "catalogue", id: "anton" }] },
      children: [
        {
          id: "film",
          type: "section",
          name: "Film",
          props: {},
          styles: { base: { fontFamily: "'Anton', sans-serif" } },
          children: [],
          hidden: false,
          locked: false,
          backgroundVideo: { src: "/media/sea.mp4", assetId: null, poster: "", overlay: "" },
        },
      ],
    },
  };
}

describe("designed pages with fonts and background videos", () => {
  it("lists the fonts to preload and the script the video needs", () => {
    const design = readPageDesign(designWithFontAndVideo(), "removeScripts");
    expect(design?.fontPreloads).toEqual(["/_lintel/fonts/anton-latin-400-normal.woff2"]);
    expect(design?.css).toContain("@font-face");
    expect(design?.html).toContain('<video src="/media/sea.mp4" muted="" loop=""');
    expect(design?.html).not.toContain("autoplay");
    expect(design?.script).toContain("prefers-reduced-motion");
  });

  describe("on the website", () => {
    const testDatabase = useTestDatabase();
    let api: FastifyInstance;
    let site: FastifyInstance;

    beforeEach(async () => {
      api = await startTestServer(testDatabase.activeDatabase, { assetExists: acceptAnyAsset });
      site = buildSiteServer({ api });
      await site.ready();
    });

    afterEach(async () => {
      await site.close();
      await api.close();
    });

    it("serves the bundled fonts to any address, and nothing else from their folder", async () => {
      const font = await site.inject({
        method: "GET",
        url: "/_lintel/fonts/bebas-neue-latin-400-normal.woff2",
      });
      expect(font.statusCode).toBe(200);
      expect(font.headers["content-type"]).toBe("font/woff2");
      expect(font.headers["access-control-allow-origin"]).toBe("*");
      expect(font.rawPayload.subarray(0, 4).toString("latin1")).toBe("wOF2");
      const missing = await site.inject({ method: "GET", url: "/_lintel/fonts/nope.woff2" });
      expect(missing.statusCode).toBe(404);
      const escape = await site.inject({ method: "GET", url: "/_lintel/fonts/..%2Fpackage.json" });
      expect(escape.statusCode).toBe(404);
    });
  });
});
