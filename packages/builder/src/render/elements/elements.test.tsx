import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type NodeBlueprint,
  type PageData,
  type PageDocument,
  standardCatalogue,
  standardComponents,
} from "@lintel/builder-model";
import { describe, expect, it } from "vitest";
import { renderPage } from "../render-page.js";
import { standardRegistry } from "../stand-in-components.js";
import { markdownToHtml } from "./markdown.js";
import { inSentence, openStreetMapAddresses, videoEmbed } from "./media-addresses.js";
import { sampleProduct } from "./shop.js";

function page(...blueprints: NodeBlueprint[]): PageDocument {
  const createId = createCountingNodeIds("e");
  const empty = createEmptyPage();
  return {
    ...empty,
    root: {
      ...empty.root,
      children: blueprints.map((blueprint) => createNode(blueprint, standardCatalogue, createId)),
    },
  };
}

const draw = (document: PageDocument, data?: PageData, mode: "site" | "canvas" = "site") =>
  renderPage(document, standardRegistry, { data, mode });

describe("drawing the element library", () => {
  it.each(
    standardComponents
      .filter((definition) => definition.type !== "page")
      .map((definition) => definition.type),
  )("%s draws on the site and on the canvas without inline styles", (type) => {
    const parent = standardCatalogue.find(type)?.allowedParents?.[0];
    const document = parent ? page({ type: parent, children: [{ type }] }) : page({ type });
    for (const mode of ["site", "canvas"] as const) {
      const { html } = draw(document, {}, mode);
      expect(html).not.toMatch(/ style="/);
    }
  });

  it("draws an accessible slider that waits to be asked before moving", () => {
    const { html, usesBehaviours } = draw(page({ type: "carousel" }));
    expect(usesBehaviours).toBe(true);
    expect(html).toContain('aria-roledescription="carousel"');
    expect(html).toContain('aria-label="Previous slide"');
    expect(html).toContain('aria-label="1 of 3"');
    expect(html).not.toContain("data-autoplay");
    expect(html).not.toContain("Pause");
    const moving = draw(
      page({ type: "carousel", props: { autoplay: true, autoplaySeconds: 5 } }),
    ).html;
    expect(moving).toContain('data-autoplay="5"');
    expect(moving).toContain("Pause");
  });

  it("draws tabs with only the first panel showing, and accordions as disclosures", () => {
    const { html } = draw(page({ type: "tabs" }, { type: "accordion" }));
    expect(html.match(/role="tab"/g)).toHaveLength(3);
    expect(html.match(/role="tabpanel"[^>]*hidden/g)).toHaveLength(2);
    expect(html).toContain('aria-selected="true"');
    expect(html.match(/<details/g)).toHaveLength(3);
  });

  it("loads videos and maps from other sites only when asked, without tracking", () => {
    const { html } = draw(
      page(
        { type: "video", props: { url: "https://youtu.be/dQw4w9WgXcQ", title: "Our bakery" } },
        { type: "map" },
      ),
    );
    expect(html).not.toContain("<iframe");
    expect(html).toContain("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    // Sentence case after the verb (LINTEL-A11Y-034): "Play our bakery", "Load a map of …".
    expect(html).toContain("Play our bakery");
    expect(inSentence("Video")).toBe("video");
    expect(inSentence("BBC film")).toBe("BBC film");
    expect(html).toContain("openstreetmap.org/export/embed.html");
    expect(videoEmbed("vimeo", "https://vimeo.com/123456789", false, false)?.embedUrl).toContain(
      "dnt=1",
    );
    expect(openStreetMapAddresses(51.5, -0.12, 15).linkUrl).toBe(
      "https://www.openstreetmap.org/?mlat=51.5&mlon=-0.12#map=15/51.5/-0.12",
    );
  });

  it("only loads the elements script for elements that need it", () => {
    expect(
      draw(page({ type: "heading" }, { type: "marquee" }, { type: "table" })).usesBehaviours,
    ).toBe(false);
    expect(draw(page({ type: "accordion" })).usesBehaviours).toBe(true);
  });

  it("repeats a collection list's item design for each entry, showing its fields", () => {
    const document = page({ type: "collectionList", props: { collection: "posts" } });
    const listId = document.root.children[0]?.id ?? "";
    const items = ["First post", "Second post"].map((title, index) => ({
      id: `post-${index}`,
      fields: {
        title,
        excerpt: `About ${title}`,
        url: `/blog/${index}`,
        image: null,
        publishedAt: "1 May 2027",
      },
    }));
    const data: PageData = {
      lists: {
        [listId]: { items, page: 1, totalPages: 2, previousUrl: null, nextUrl: "/?page=2" },
      },
    };
    const site = draw(document, data).html;
    expect(site).toContain("<h3");
    expect(site).toContain("First post");
    expect(site).toContain("Second post");
    expect(site).toContain('href="/blog/1"');
    expect(site).not.toContain("Entry title");

    const canvas = draw(document, data, "canvas").html;
    // The first copy is the one to select and edit; the others follow it.
    expect(canvas.match(/data-lintel-node="e3"/g)).toHaveLength(1);
    expect(canvas).toContain('data-lintel-repeat=""');

    const empty = draw(document, {
      lists: { [listId]: { items: [], page: 1, totalPages: 1, previousUrl: null, nextUrl: null } },
    }).html;
    expect(empty).toContain("Nothing here yet");
  });

  it("draws a product grid and a product page from the shop's products", () => {
    const grid = page({ type: "productGrid" });
    const gridId = grid.root.children[0]?.id ?? "";
    const data: PageData = {
      productLists: {
        [gridId]: {
          products: [sampleProduct],
          page: 1,
          totalPages: 1,
          previousUrl: null,
          nextUrl: null,
          sortUrls: {},
          sort: "featured",
        },
      },
    };
    const html = draw(grid, data).html;
    expect(html).toContain("Linen shirt");
    expect(html).toContain("£45.00");
    expect(html).toContain('href="/products/sample-product"');

    const product = draw(
      page({ type: "productPrice" }, { type: "variantPicker" }, { type: "addToCart" }),
      { product: sampleProduct },
    ).html;
    expect(product).toMatch(/data-price="was" hidden="">.*<span data-price="was-amount"><\/span>/);
    expect(product).toContain('"compareAtPrice":"£60.00"');
    expect(product).toContain("<legend>Size</legend>");
    expect(product).toContain('name="variantId" value="sample-S"');
    expect(product).toContain('data-product-variants="sample-product"');
    expect(draw(page({ type: "productPrice" })).html).toBe('<div class="page"></div>');
  });

  // A shop without payments or delivery looked open; now its products say they're coming.
  it("says coming soon, not sold out, while the shop can't take orders", () => {
    const comingSoon = {
      ...sampleProduct,
      comingSoon: true,
      availableForSale: false,
      variants: sampleProduct.variants.map((variant) => ({ ...variant, availableForSale: false })),
    };

    const html = draw(page({ type: "addToCart" }), { product: comingSoon }).html;

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Coming soon<\/button>/);
    expect(html).toContain('data-sold-out-label="Coming soon"');
    expect(html).not.toContain("Sold out");
  });

  it("writes rich text as safe HTML", () => {
    expect(markdownToHtml("## Hello\n\nSome **bold** and a [link](/about).\n\n- one\n- two")).toBe(
      '<h2>Hello</h2><p>Some <strong>bold</strong> and a <a href="/about">link</a>.</p><ul><li>one</li><li>two</li></ul>',
    );
    expect(markdownToHtml("<script>alert(1)</script> [x](javascript:alert(1))")).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt; x</p>",
    );
  });
});
