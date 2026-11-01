import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type NodeBlueprint,
  type PageDocument,
  type ShopProduct,
  standardCatalogue,
} from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureBlogPostsCollection,
  pagesWithSimpleSectionsCollection,
} from "../collections/default-collections.js";
import { ensureCollection } from "../collections/collections.service.js";
import { acceptAnyAsset } from "../fieldtypes/image-assets.js";
import { ensureSiteSettings } from "../globals/default-globals.js";
import { ensureMainMenu } from "../navigation/default-navigation.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createHomePage } from "../testing/test-home-page.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { buildSiteServer } from "./site-server.js";
import { noSources, readForm, readStorefrontProduct, type SiteSources } from "./site-sources.js";

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

const shirt = readStorefrontProduct({
  id: "6c1d0000-0000-4000-8000-000000000001",
  handle: "linen-shirt",
  title: "Linen shirt",
  descriptionHtml: "<p>Cool in summer.</p>",
  images: [
    { id: "i1", url: "/media/shirt.jpg", alt: "A blue linen shirt", width: 1600, height: 2000 },
  ],
  options: [{ name: "Size", values: ["S", "M"] }],
  priceRange: { min: { amount: 4500, currency: "GBP" }, max: { amount: 4500, currency: "GBP" } },
  availableForSale: true,
  variants: [
    {
      id: "v-s",
      title: "S",
      optionValues: ["S"],
      price: { amount: 4500, currency: "GBP" },
      compareAtPrice: null,
      availableForSale: true,
    },
    {
      id: "v-m",
      title: "M",
      optionValues: ["M"],
      price: { amount: 4500, currency: "GBP" },
      compareAtPrice: { amount: 6000, currency: "GBP" },
      availableForSale: true,
    },
  ],
}) as ShopProduct;

const fakeShop: SiteSources = {
  shop: {
    listProducts: async () => ({ products: [shirt], total: 1 }),
    findProduct: async (handle) => (handle === shirt.handle ? shirt : null),
    listCollections: async () => [
      { handle: "summer", title: "Summer", description: "Light things." },
    ],
    findCollection: async (handle) =>
      handle === "summer" ? { handle, title: "Summer", description: "Light things." } : null,
  },
  forms: {
    findForm: async (handle) =>
      readForm({
        handle,
        name: "Newsletter",
        submitLabel: "Join",
        fields: [
          { handle: "email", type: "email", label: "Email address", required: true, options: {} },
        ],
        spamProtection: { honeypotField: "_website", tokenField: "_token", token: "123.abc" },
        confirmation: { type: "message", message: "Thanks for joining." },
      }),
  },
};

// Each test publishes several entries and renders pages through two servers.
describe("designed pages with the element library", { timeout: 30000 }, () => {
  const testDatabase = useTestDatabase();
  let api: FastifyInstance;
  let site: FastifyInstance;
  let admin: SendRequest;

  beforeEach(async () => {
    api = await startTestServer(testDatabase.activeDatabase, { assetExists: acceptAnyAsset });
    site = buildSiteServer({ api, sources: fakeShop });
    await site.ready();
    await ensureCollection(testDatabase.database, pagesWithSimpleSectionsCollection);
    await ensureBlogPostsCollection(testDatabase.database);
    await ensureSiteSettings(testDatabase.database);
    await ensureMainMenu(testDatabase.database);
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    admin = requestsAs(api, await signInAndGetCookies(api, "owner@example.com"));
    // The first page at the top is "/", so the pages below answer at their own addresses.
    await createHomePage(admin);
  }, 30000);

  afterEach(async () => {
    await site.close();
    await api.close();
  });

  const visit = (url: string) => site.inject({ method: "GET", url });

  async function publish(collection: string, data: Record<string, unknown>, slug?: string) {
    const created = await admin("POST", `/collections/${collection}/entries`, {
      data,
      ...(slug ? { slug } : {}),
    });
    expect(created.statusCode, created.body).toBe(201);
    const published = await admin("POST", `/entries/${created.json().id}/publish`);
    expect(published.statusCode, published.body).toBe(200);
  }

  async function publishPosts(count: number) {
    for (let index = 1; index <= count; index += 1) {
      await publish(
        "posts",
        { title: `Post number ${index}`, excerpt: `About post ${index}` },
        `post-${index}`,
      );
    }
  }

  it("fills a collection list with the newest posts, a page at a time", async () => {
    await publishPosts(3);
    await publish(
      "pages",
      {
        title: "News",
        design: design({
          type: "collectionList",
          props: { collection: "posts", limit: 2, paginate: true },
        }),
      },
      "news",
    );
    const first = await visit("/news");
    expect(first.statusCode).toBe(200);
    expect(first.body).toContain("Post number 3");
    expect(first.body).toContain("Post number 2");
    expect(first.body).not.toContain("Post number 1");
    expect(first.body).toContain('href="/blog/post-3"');
    expect(first.body).toContain('href="/news?page=2"');
    const second = await visit("/news?page=2");
    expect(second.body).toContain("Post number 1");
    expect(second.body).toContain("Page 2 of 2");
  });

  it("sorts by title and says so when there is nothing to show", async () => {
    await publishPosts(2);
    await publish(
      "pages",
      {
        title: "Index",
        design: design(
          { type: "collectionList", props: { collection: "posts", sort: "titleZToA", limit: 1 } },
          {
            type: "collectionList",
            props: {
              collection: "posts",
              term: "categories/none",
              emptyText: "No bread posts yet.",
            },
          },
        ),
      },
      "archive",
    );
    const page = await visit("/archive");
    expect(page.body).toContain("Post number 2");
    expect(page.body).not.toContain("Post number 1");
    expect(page.body).toContain("No bread posts yet.");
  });

  it("draws every post with the site's post design, showing that post's fields", async () => {
    await publishPosts(1);
    const postDesign = design(
      { type: "heading", props: { text: "Title", level: 1 }, bindings: { text: "title" } },
      { type: "text", bindings: { text: "excerpt" } },
    );
    await publish(
      "pages",
      {
        title: "Post design",
        design: { ...postDesign, root: { ...postDesign.root, props: { itemDesignFor: "posts" } } },
      },
      "post-design",
    );
    const post = await visit("/blog/post-1");
    expect(post.statusCode).toBe(200);
    expect(post.body).toContain('class="lintel-design"');
    expect(post.body).toMatch(/<h1[^>]*>Post number 1<\/h1>/);
    expect(post.body).toContain("About post 1");
    // The design's own address shows it with the newest post as the example.
    expect((await visit("/post-design")).body).toContain("Post number 1");
  });

  it("loads the elements script only for pages that need it", async () => {
    await publish(
      "pages",
      { title: "Plain", design: design({ type: "heading" }, { type: "marquee" }) },
      "plain",
    );
    await publish("pages", { title: "Slides", design: design({ type: "carousel" }) }, "slides");
    expect((await visit("/plain")).body).not.toContain("/_lintel/elements-");
    const slides = (await visit("/slides")).body;
    const script = /src="(\/_lintel\/elements-[0-9a-f]{12}\.js)"/.exec(slides)?.[1];
    expect(script).toBeDefined();
    const served = await visit(script ?? "");
    expect(served.statusCode).toBe(200);
    expect(served.headers["content-type"]).toContain("text/javascript");
  });

  it("serves the shop's pages with their default designs while the shop is on", async () => {
    expect((await visit("/shop")).statusCode).toBe(404);
    await admin("PUT", "/plugins", { enabled: ["commerce"] });
    const shop = await visit("/shop");
    expect(shop.statusCode).toBe(200);
    expect(shop.body).toContain("Linen shirt");
    expect(shop.body).toContain("£45.00");
    const product = await visit("/products/linen-shirt");
    expect(product.statusCode).toBe(200);
    expect(product.body).toMatch(/<h1[^>]*>Linen shirt<\/h1>/);
    expect(product.body).toContain('name="variantId" value="v-s"');
    expect(product.body).toContain("Cool in summer.");
    expect((await visit("/shop/summer")).body).toContain("Light things.");
    expect((await visit("/shop/winter")).statusCode).toBe(404);
    expect((await visit("/products/nothing")).statusCode).toBe(404);
    const cart = await visit("/cart");
    expect(cart.body).toContain('data-cart-view="page"');
    expect(cart.body).toContain('name="robots" content="noindex');
    expect((await visit("/order-confirmation")).body).toContain("Thank you for your order");
  });

  it("draws a chosen form that posts through the website", async () => {
    await publish(
      "pages",
      {
        title: "Join",
        design: design({ type: "newsletterSignup", props: { form: "newsletter" } }),
      },
      "join",
    );
    const page = (await visit("/join")).body;
    expect(page).toContain('action="/_lintel/api/forms/newsletter/submissions"');
    expect(page).toContain('name="_token" value="123.abc"');
    expect(page).toMatch(/<input id="newsletter-\w+" type="email"[^>]*name="email"/);
  });

  it("passes the storefront and forms APIs through, and answers plainly while they are off", async () => {
    const plain = buildSiteServer({ api, sources: noSources });
    await plain.ready();
    const response = await plain.inject({
      method: "POST",
      url: "/_lintel/api/shop/carts",
      payload: { country: "GB" },
    });
    expect(response.statusCode).toBe(404);
    expect(response.headers["cache-control"]).toBe("no-store");
    await plain.close();
  });

  it("finds published pages and posts for the Search box", async () => {
    await publishPosts(2);
    const results = (await visit("/search?q=number%202")).body;
    expect(results).toContain("Search results for “number 2”");
    expect(results).toContain("Post number 2");
    expect(results).not.toContain("Post number 1");
    const nothing = (await visit("/search?q=croissant")).body;
    expect(nothing).toContain("Search results for “croissant”");
    expect(nothing).not.toContain("Post number");
  });

  it("tells the builder about collections, their fields, terms and samples", async () => {
    await publishPosts(1);
    const response = await admin("GET", "/website/builder-data");
    expect(response.statusCode, response.body).toBe(200);
    const posts = response
      .json()
      .collections.find((collection: { handle: string }) => collection.handle === "posts");
    expect(posts.fields.map((field: { path: string }) => field.path)).toContain("data.excerpt");
    expect(posts.samples[0].fields.title).toBe("Post number 1");
    expect(response.json().products).toEqual([]);
  });
});
