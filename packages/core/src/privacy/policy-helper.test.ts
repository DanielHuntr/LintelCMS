import { describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { eq } from "drizzle-orm";
import { marketsTable } from "../commerce/markets/markets.table.js";
import { draftPolicySections, mentions, pageText } from "./policy-helper.service.js";
import { defaultRetentionRules } from "./privacy.schema.js";
import { usePrivacyTestServer } from "./privacy-test-server.js";
import { detectProcessors } from "./processors.service.js";
import type { SiteServices } from "./site-services.service.js";

const nothing: SiteServices = {
  forms: null,
  shop: null,
  visitors: false,
  tests: false,
  embeds: [],
  adobeFonts: false,
  hostedGoogleFonts: false,
  emailService: null,
  addons: [],
  retention: { ...defaultRetentionRules },
};

describe("the privacy policy helper", () => {
  it("writes only about what the site uses, and always about people's rights", () => {
    expect(draftPolicySections(nothing).map((section) => section.heading)).toEqual(["Your rights"]);

    const sections = draftPolicySections({
      ...nothing,
      forms: { names: ["Contact"], hasConsentBoxes: true, spamCheck: false },
      shop: { paymentProviders: ["Stripe", "PayPal"] },
      embeds: [{ id: "youtube", name: "YouTube" }],
      adobeFonts: true,
      retention: { ...defaultRetentionRules, formEntries: { enabled: true, days: 365 } },
    });
    expect(sections.map((section) => section.heading)).toEqual([
      "Forms",
      "Orders",
      "Content from other websites",
      "Fonts",
      "Your rights",
    ]);
    const text = sections.map((section) => section.text).join(" ");
    expect(text).toContain("exact words you agreed to");
    expect(text).toContain("We delete form messages after a year.");
    expect(text).toContain("Payments are handled by Stripe and PayPal.");
    expect(text).toContain("YouTube");
    expect(text).toContain("Adobe");
  });

  it("reads a page's text for the check, without its markup", () => {
    expect(
      pageText({ title: "Privacy", body: ["<p>We use <b>Stripe</b></p>", { more: "Forms" }] }),
    ).toBe("privacy we use stripe forms");
  });

  it("counts a word only where a word starts, so a design's CSS doesn't pass the check", () => {
    expect(mentions("our forms and orders", "form")).toBe(true);
    expect(mentions("platform border-radius", "form")).toBe(false);
    expect(mentions("platform border-radius", "order")).toBe(false);
    expect(mentions("sent by mail.example.com", "mail.example.com")).toBe(true);
  });

  it("lists the companies the site sends data to", () => {
    const processors = detectProcessors({
      ...nothing,
      forms: { names: [], hasConsentBoxes: false, spamCheck: true },
      shop: { paymentProviders: ["Stripe"] },
      emailService: "Postmark",
      addons: [{ id: "chat", name: "Chat", description: null, services: ["Intercom"] }],
    });
    expect(processors.map((processor) => processor.name)).toEqual([
      "Stripe",
      "Postmark",
      "Cloudflare Turnstile",
      "Intercom",
    ]);
  });

  describe("on a site", () => {
    const testDatabase = useTestDatabase();
    const privacy = usePrivacyTestServer(testDatabase);

    it("drafts from what is switched on, and checks the privacy page mentions it", async () => {
      const before = await privacy.api("GET", "/privacy/policy");
      expect(before.statusCode).toBe(200);
      expect(before.json()).toMatchObject({ privacyPage: null, notMentioned: [] });
      expect(before.json().draft).toMatch(/^What this site collects\n\nForms\n/);

      await privacy.createMarket();
      await ensurePagesCollection(testDatabase.database);
      const page = await privacy.api("POST", "/collections/pages/entries", {
        data: { title: "How we use your form messages" },
        slug: "privacy",
      });
      expect(page.statusCode, page.body).toBe(201);
      const published = await privacy.api("POST", `/entries/${page.json().id}/publish`);
      expect(published.statusCode, published.body).toBe(200);

      const after = await privacy.api("GET", "/privacy/policy");
      expect(after.json().privacyPage).toMatchObject({ title: "How we use your form messages" });
      // Forms are mentioned; the shop's orders aren't.
      expect(after.json().notMentioned).toEqual(["Orders", "Stripe"]);
    });

    it("keeps the companies the owner adds, beside those it finds", async () => {
      await privacy.createMarket();
      const saved = await privacy.api("PUT", "/privacy/processors", {
        processors: [
          { id: "host", name: "Bytemark", purpose: "Hosts the website", location: "UK", link: "" },
        ],
      });
      expect(saved.statusCode).toBe(200);
      expect(saved.json().added).toEqual([
        expect.objectContaining({ name: "Bytemark", origin: "added" }),
      ]);
      expect(saved.json().detected).toEqual([
        expect.objectContaining({ name: "Stripe", origin: "detected" }),
      ]);
      // A market set to a provider that isn't connected takes no payments through it.
      await testDatabase.database
        .update(marketsTable)
        .set({ paymentProvider: "paypal" })
        .where(eq(marketsTable.handle, "uk"));
      expect((await privacy.api("GET", "/privacy/processors")).json().detected).toEqual([]);

      const refused = await privacy.api("PUT", "/privacy/processors", {
        processors: [{ id: "x", name: "" }],
      });
      expect(refused.statusCode).toBe(400);
    });
  });
});
