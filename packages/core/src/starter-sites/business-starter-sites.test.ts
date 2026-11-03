import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { acceptAnyAsset } from "../fieldtypes/image-assets.js";
import { ensureSiteSettings } from "../globals/default-globals.js";
import { ensureMainMenu } from "../navigation/default-navigation.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { buildSiteServer } from "../website/site-server.js";

const SITE_URL = "http://localhost:3998";

/** The six starter sites for common kinds of business, and what each home page must show. */
const businesses = [
  {
    id: "tollbooth",
    headingFont: "Fraunces",
    title: "Wood smoke, Scottish fish and one long table in the old toll house.",
    picture: "tollbooth-house",
    footer: "Tollbooth Restaurant Ltd",
    page: ["/menu", "Orkney scallops"],
  },
  {
    id: "hollis",
    headingFont: "Syne",
    title: "Cuts, colour and skin, done slowly on Gertrude Street.",
    picture: "hollis-mirror",
    footer: "Hollis Hair &amp; Skin Pty Ltd",
    page: ["/services", "Lived-in colour"],
  },
  {
    id: "verveine",
    headingFont: "Playfair Display",
    title: "Weddings in Provence, planned like a long lunch with friends.",
    picture: "verveine-mas",
    footer: "Verveine Événements",
    page: ["/weddings", "Partial planning"],
  },
  {
    id: "lind",
    headingFont: "Unbounded",
    title: "Useful, lovely things for the home.",
    picture: "lind-vase",
    footer: "Lind ApS",
    page: ["/shop", "Lambswool throw"],
  },
  {
    id: "halyard",
    headingFont: "Big Shoulders Display",
    title: "Get strong. Stay supple.",
    picture: "halyard-strength",
    footer: "Halyard Studio (Pty) Ltd",
    page: ["/timetable", "Wednesday"],
  },
  {
    id: "northside",
    headingFont: "DM Serif Display",
    title: "Neighbours looking after neighbours in Phibsborough.",
    picture: "northside-street",
    footer: "Registered charity number 20071234",
    page: ["/get-involved", "Give food"],
  },
] as const;

describe("starting from one of the business templates", () => {
  const testDatabase = useTestDatabase();
  let api: FastifyInstance;
  let site: FastifyInstance;
  let owner: SendRequest;

  beforeEach(async () => {
    api = await startTestServer(testDatabase.activeDatabase, {
      assetExists: acceptAnyAsset,
      website: { builtInSiteUrl: SITE_URL },
    });
    site = buildSiteServer({ api });
    await site.ready();
    await ensureSiteSettings(testDatabase.database);
    await ensureMainMenu(testDatabase.database);
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    owner = requestsAs(api, await signInAndGetCookies(api, "owner@example.com"));
  });

  afterEach(async () => {
    await site.close();
    await api.close();
  });

  const visit = (url: string) => site.inject({ method: "GET", url });

  it.each(businesses)(
    "applies $id: its fonts, its home page, its own footer and its drawings",
    async (business) => {
      const response = await owner("POST", `/starter-sites/${business.id}/apply`, {
        publish: true,
      });
      expect(response.statusCode, response.body).toBe(201);
      expect(response.json()).toMatchObject({ themeApplied: true, menuFilled: true });
      const website = (await owner("GET", "/website")).json();
      expect(website).toMatchObject({ headingFont: business.headingFont });

      const home = await visit("/");
      expect(home.statusCode).toBe(200);
      expect(home.body).toContain(business.title);
      expect(home.body).toContain(`src="/_lintel/illustrations/${business.picture}.svg"`);
      expect(home.body).toContain(business.footer);
      const [address, words] = business.page;
      const page = await visit(address);
      expect(page.statusCode).toBe(200);
      expect(page.body).toContain(words);
      const picture = await visit(`/_lintel/illustrations/${business.id}-cover.svg`);
      expect(picture.statusCode).toBe(200);
    },
  );
});
