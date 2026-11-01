import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { splitWordPressContent } from "./wordpress-content.js";
import { piecesToRichText } from "./wordpress-rich-text.js";
import { parseWordPressExport } from "./wxr-parser.js";

const bakery = readFileSync(new URL("./fixtures/small-bakery.xml", import.meta.url), "utf8");

describe("reading a WordPress export", () => {
  it("finds the site, its people, categories, tags and content", () => {
    const site = parseWordPressExport(bakery);

    expect(site.title).toBe("Hillside Bakery");
    expect(site.authors).toEqual([
      { login: "maria", email: "maria@hillside-bakery.example", displayName: "Maria Baker" },
      { login: "tom", email: "tom@hillside-bakery.example", displayName: "Tom Flour" },
    ]);
    expect(site.categories.map((category) => category.name)).toEqual(["News", "Recipes & tips"]);
    expect(site.tags).toEqual([{ slug: "sourdough", name: "Sourdough", parentSlug: "" }]);
    expect(site.items.map((item) => `${item.type}:${item.slug}`)).toEqual([
      "attachment:loaf-on-the-counter",
      "post:our-new-sourdough",
      "post:easter-opening-hours",
      "post:old-offer",
      "page:about-us",
      "page:our-team",
    ]);
    expect(site.ignoredItemTypes).toEqual({ nav_menu_item: 1 });

    const post = site.items[1];
    expect(post).toMatchObject({
      status: "publish",
      date: "2024-03-02T10:30:00.000Z",
      authorLogin: "maria",
      categories: ["news"],
      tags: ["sourdough"],
      featuredImageId: "10",
    });
    expect(site.items[5]?.parentId).toBe("20");
  });

  it("explains a file that isn't a WordPress export", () => {
    expect(() => parseWordPressExport("<rss><channel></channel></rss>")).toThrow(
      /isn't a WordPress export/,
    );
    expect(() => parseWordPressExport("<<not xml")).toThrow(/well-formed/);
  });
});

describe("converting WordPress content", () => {
  it("turns block editor content into rich text, images and HTML blocks", () => {
    const post = parseWordPressExport(bakery).items[1];
    const pieces = splitWordPressContent(post?.content ?? "");

    expect(pieces.map((piece) => piece.kind)).toEqual([
      "rich",
      "rich",
      "rich",
      "image",
      "html",
      "rich",
    ]);
    const { document, keptAsHtml } = piecesToRichText(pieces, (url) =>
      url.endsWith("loaf.png") ? "https://api.test/media/1/file" : null,
    );
    expect(keptAsHtml).toEqual(["image", "embed"]);
    expect(document.content?.map((node) => node.type)).toEqual([
      "paragraph",
      "heading",
      "bulletList",
      "codeBlock",
      "codeBlock",
      "blockquote",
    ]);
    expect(JSON.stringify(document.content?.[0])).toContain('"bold"');
    expect(JSON.stringify(document.content?.[3])).toContain("https://api.test/media/1/file");
  });

  it("adds paragraphs to classic content and keeps shortcodes as HTML", () => {
    const post = parseWordPressExport(bakery).items[2];
    const pieces = splitWordPressContent(post?.content ?? "");

    expect(pieces).toEqual([
      { kind: "rich", html: "<p>We're open on Good Friday.</p>" },
      { kind: "rich", html: "<p>Closed on Easter Monday. " },
      {
        kind: "image",
        url: "https://hillside-bakery.example/wp-content/uploads/2024/03/bunny.gif",
        alt: "",
        caption: "",
      },
      { kind: "html", html: '[gallery ids="10"]', reason: "[gallery] shortcode" },
    ]);
  });

  it("keeps unknown blocks, nested or not, whole", () => {
    const pieces = splitWordPressContent(
      "<!-- wp:columns --><div><!-- wp:column --><p>A</p><!-- /wp:column --></div><!-- /wp:columns --><!-- wp:latest-posts /-->",
    );
    expect(pieces).toEqual([
      { kind: "html", html: "<div><p>A</p></div>", reason: "columns" },
      { kind: "html", html: "", reason: "latest-posts" },
    ]);
  });
});
