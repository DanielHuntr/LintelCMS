import {
  createEmptyPage,
  createNode,
  pageLinkHref,
  standardCatalogue,
} from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pagesWithSimpleSectionsCollection } from "../collections/default-collections.js";
import { ensureCollection } from "../collections/collections.service.js";
import {
  acceptAnyAsset,
  type AssetLookup,
  type DeliveredAsset,
} from "../fieldtypes/image-assets.js";
import { ensureSiteSettings } from "../globals/default-globals.js";
import { ensureMainMenu } from "../navigation/default-navigation.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createHomePage } from "../testing/test-home-page.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { buildSiteServer } from "../website/site-server.js";

const SITE_URL = "http://localhost:3998";

const photo: DeliveredAsset = {
  id: "6f1c2a8e-4b3d-4c5e-9f00-0a1b2c3d4e5f",
  url: "http://localhost:4000/media/6f1c2a8e-4b3d-4c5e-9f00-0a1b2c3d4e5f/file",
  alt: "Loaves on a shelf",
  width: 1600,
  height: 900,
  focalPoint: null,
};

/** "Visit our story page" linking to a page by its id, with a picture after it. */
function bodyLinkingTo(entryId: string) {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Visit " },
          {
            type: "text",
            text: "our story",
            marks: [{ type: "link", attrs: { href: pageLinkHref(entryId) } }],
          },
        ],
      },
      {
        type: "image",
        attrs: { assetId: photo.id, alt: "Fresh loaves", caption: "Baked at six", align: "full" },
      },
    ],
  };
}

function designWithButtonTo(entryId: string) {
  const design = createEmptyPage();
  design.root.children = [
    createNode(
      { type: "button", props: { label: "Read our story", href: pageLinkHref(entryId) } },
      standardCatalogue,
      () => "story-button",
    ),
  ];
  return design;
}

describe("links to pages follow the page", { timeout: 30000 }, () => {
  const testDatabase = useTestDatabase();
  let api: FastifyInstance;
  let site: FastifyInstance;
  let admin: SendRequest;

  beforeEach(async () => {
    const assetLookup: AssetLookup = {
      findAssetsByIds: async (ids) => new Map(ids.includes(photo.id) ? [[photo.id, photo]] : []),
    };
    api = await startTestServer(testDatabase.activeDatabase, {
      assetLookup,
      assetExists: acceptAnyAsset,
      website: { builtInSiteUrl: SITE_URL },
    });
    site = buildSiteServer({ api });
    await site.ready();
    await ensureCollection(testDatabase.database, pagesWithSimpleSectionsCollection);
    await ensureSiteSettings(testDatabase.database);
    await ensureMainMenu(testDatabase.database);
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    admin = requestsAs(api, await signInAndGetCookies(api, "owner@example.com"));
    await createHomePage(admin);
  });

  afterEach(async () => {
    await site.close();
    await api.close();
  });

  async function publish(data: Record<string, unknown>, slug: string): Promise<string> {
    const created = await admin("POST", "/collections/pages/entries", { data, slug });
    expect(created.statusCode, created.body).toBe(201);
    const published = await admin("POST", `/entries/${created.json().id}/publish`);
    expect(published.statusCode, published.body).toBe(200);
    return created.json().id as string;
  }

  function deliver(url: string) {
    return api.inject({ method: "GET", url }).then((response) => response.json());
  }

  function visit(url: string) {
    return site.inject({ method: "GET", url }).then((response) => response.body);
  }

  /** A page linking to `storyId` from its text, a hero button and its design. */
  async function publishLinkingPage(storyId: string) {
    return publish(
      {
        title: "Welcome",
        body: bodyLinkingTo(storyId),
        sections: [
          {
            id: "hero-1",
            type: "hero",
            data: { heading: "Hello", button: { url: pageLinkHref(storyId), label: "Our story" } },
          },
        ],
      },
      "welcome",
    );
  }

  it("delivers the page's address in rich text, Link fields and pictures", async () => {
    const storyId = await publish({ title: "Our story" }, "story");
    await publishLinkingPage(storyId);

    const { data } = await deliver("/delivery/pages/welcome");

    expect(data.body.html).toContain('href="/story">our story</a>');
    expect(data.body.html).toMatch(
      /<figure class="lintel-picture lintel-picture--full"><img [^>]*alt="Fresh loaves"[^>]*><figcaption>Baked at six<\/figcaption><\/figure>/,
    );
    expect(data.body.json.content[0].content[1].marks[0].attrs).toMatchObject({
      href: "/story",
      entryId: storyId,
    });
    expect(data.body.json.content[1].attrs).toEqual({
      assetId: photo.id,
      alt: "Fresh loaves",
      caption: "Baked at six",
      align: "full",
      image: photo,
    });
    expect(data.sections[0].data.button).toEqual({
      url: "/story",
      label: "Our story",
      entryId: storyId,
    });
    // Nothing internal reaches a website.
    expect(JSON.stringify(data)).not.toContain("lintel:page/");
  });

  it("follows the page when its address changes, on the site too", async () => {
    const storyId = await publish({ title: "Our story" }, "story");
    await publishLinkingPage(storyId);

    await admin("PATCH", `/entries/${storyId}`, { slug: "our-story" });
    await admin("POST", `/entries/${storyId}/publish`);

    const { data } = await deliver("/delivery/pages/welcome");
    expect(data.body.html).toContain('href="/our-story">our story</a>');
    expect(data.sections[0].data.button.url).toBe("/our-story");
    const page = await visit("/welcome");
    expect(page).toContain('href="/our-story"');
    expect(page).toContain('alt="Fresh loaves"');
    expect(page).not.toContain("lintel:page/");
  });

  it("draws a link to a page in the bin as plain words, and drops a button to it", async () => {
    const storyId = await publish({ title: "Our story" }, "story");
    await publishLinkingPage(storyId);

    const binned = await admin("POST", `/content-tree/entries/${storyId}/recycle`);
    expect(binned.statusCode, binned.body).toBe(201);

    const { data } = await deliver("/delivery/pages/welcome");
    expect(data.body.html).toContain("<p>Visit our story</p>");
    expect(data.sections[0].data.button).toBeNull();
    const page = await visit("/welcome");
    expect(page).toContain("Visit our story");
    expect(page).not.toContain("lintel:page/");
  });

  it("keeps old typed addresses as they were", async () => {
    await publish(
      {
        title: "Old",
        sections: [
          { id: "hero-1", type: "hero", data: { heading: "Hi", button: { url: "/about" } } },
        ],
      },
      "old",
    );
    const { data } = await deliver("/delivery/pages/old");
    expect(data.sections[0].data.button).toEqual({ url: "/about" });
  });

  it("swaps links in a page's design for the page's address, and previews follow too", async () => {
    const storyId = await publish({ title: "Our story" }, "story");
    const designedId = await publish(
      { title: "Designed", design: designWithButtonTo(storyId) },
      "designed",
    );

    expect(JSON.stringify((await deliver("/delivery/pages/designed")).data.design)).toContain(
      '"href":"/story"',
    );
    expect(await visit("/designed")).toMatch(/<a[^>]*href="\/story"[^>]*>[^<]*Read our story/);

    await admin("PATCH", `/entries/${storyId}`, { slug: "the-story" });
    await admin("POST", `/entries/${storyId}/publish`);
    await admin("PATCH", `/entries/${designedId}`, { data: { title: "Designed, edited" } });
    const preview = await admin("POST", `/entries/${designedId}/preview`);
    const draft = await visit(String(preview.json().previewUrl).slice(SITE_URL.length));
    expect(draft).toContain('href="/the-story"');
    expect(draft).not.toContain("lintel:page/");

    await admin("POST", `/content-tree/entries/${storyId}/recycle`);
    const withoutStory = await visit("/designed");
    expect(withoutStory).toContain("Read our story");
    expect(withoutStory).not.toMatch(/<a[^>]*href="[^"]*"[^>]*>[^<]*Read our story/);
  });
});
