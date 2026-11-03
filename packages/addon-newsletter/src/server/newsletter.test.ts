import { type PluginTestServer, startPluginTestServer } from "@lintel/core/plugin-testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createNewsletterAddon } from "./index.js";
import { mailchimpDataCentre, mailchimpMemberId } from "./newsletter-providers.js";

/**
 * The Newsletter sign-up add-on on a real Lintel, with Mailchimp and Brevo played by a
 * stand-in `fetch` that records what it was asked and answers as the services do.
 */

interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

const MAILCHIMP_KEY = `${"0123456789abcdef".repeat(2)}-us21`;
const BREVO_KEY = "xkeysib-good-key-a1b2";

const calls: RecordedCall[] = [];
/** What the services answer to sign-ups; tests change it to try refusals. */
let signUpStatus = 200;
let servicesDown = false;

const fakeFetch: typeof fetch = async (input, init) => {
  if (servicesDown) throw new TypeError("fetch failed");
  const url = String(input);
  const headers = Object.fromEntries(new Headers(init?.headers).entries());
  const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
  calls.push({ url, method: init?.method ?? "GET", headers, body });
  const json = (status: number, value: unknown) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { "content-type": "application/json" },
    });

  if (url.startsWith("https://us21.api.mailchimp.com/3.0/lists?")) {
    const expected = `Basic ${Buffer.from(`lintel:${MAILCHIMP_KEY}`).toString("base64")}`;
    if (headers.authorization !== expected) return json(401, { title: "API Key Invalid" });
    return json(200, { lists: [{ id: "abc123", name: "Bakery news" }] });
  }
  if (url.startsWith("https://us21.api.mailchimp.com/3.0/lists/abc123/members/")) {
    return json(signUpStatus, { status: "pending" });
  }
  if (url === "https://api.brevo.com/v3/contacts/lists?limit=50&offset=0") {
    if (headers["api-key"] !== BREVO_KEY) return json(401, { code: "unauthorized" });
    return json(200, { lists: [{ id: 7, name: "Customers" }], count: 1 });
  }
  if (url.startsWith("https://api.brevo.com/v3/contacts")) {
    return signUpStatus === 200 ? new Response(null, { status: 204 }) : json(signUpStatus, {});
  }
  return json(404, {});
};

const addon = createNewsletterAddon({ fetch: fakeFetch, signUpsPerMinute: 1000 });
const SUBSCRIBE = "/delivery/add-ons/newsletter/subscribe";

describe("the Newsletter sign-up add-on", () => {
  let lintel: PluginTestServer;
  let asOwner: Awaited<ReturnType<PluginTestServer["signInWith"]>>;

  beforeAll(async () => {
    lintel = await startPluginTestServer({ plugins: [addon] });
    asOwner = await lintel.signInWith(["*"]);
  });

  afterAll(() => lintel.close());

  beforeEach(async () => {
    calls.length = 0;
    signUpStatus = 200;
    servicesDown = false;
    await lintel.setEnabledPlugins(["newsletter"]);
    await asOwner({ method: "DELETE", url: "/newsletter/connection" });
  });

  const connectMailchimp = (doubleOptIn = true) =>
    asOwner({
      method: "PUT",
      url: "/newsletter/connection",
      payload: { provider: "mailchimp", apiKey: MAILCHIMP_KEY, listId: "abc123", doubleOptIn },
    });

  const signUp = (payload: Record<string, unknown>) =>
    lintel.server.inject({ method: "POST", url: SUBSCRIBE, payload });

  describe("connecting", () => {
    it("tries the key, saves it and never sends it back", async () => {
      const saved = await connectMailchimp();
      expect(saved.statusCode).toBe(200);
      expect(saved.json()).toEqual({
        connected: true,
        provider: "mailchimp",
        keyHint: "…us21",
        listId: "abc123",
        listName: "Bakery news",
        doubleOptIn: true,
        brevoTemplateId: null,
        brevoConfirmUrl: "",
      });
      const read = await asOwner({ method: "GET", url: "/newsletter/connection" });
      expect(read.json()).toEqual(saved.json());
      expect(read.body).not.toContain(MAILCHIMP_KEY);
    });

    it("says plainly when the key isn't accepted", async () => {
      const response = await asOwner({
        method: "PUT",
        url: "/newsletter/connection",
        payload: { provider: "mailchimp", apiKey: "wrong-us21", listId: "abc123" },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe(
        "That API key wasn't accepted by Mailchimp. Copy it again from your Mailchimp account.",
      );
      const shapeless = await asOwner({
        method: "PUT",
        url: "/newsletter/connection",
        payload: { provider: "mailchimp", apiKey: "no-data-centre", listId: "abc123" },
      });
      expect(shapeless.json().message).toContain("such as -us21");
    });

    it("refuses a list the account doesn't have", async () => {
      const response = await asOwner({
        method: "PUT",
        url: "/newsletter/connection",
        payload: { provider: "brevo", apiKey: BREVO_KEY, listId: "99", doubleOptIn: false },
      });
      expect(response.json().code).toBe("NEWSLETTER_LIST_NOT_FOUND");
    });

    it("lists the account's lists with a key just typed, or the saved one", async () => {
      const typed = await asOwner({
        method: "POST",
        url: "/newsletter/lists",
        payload: { provider: "brevo", apiKey: BREVO_KEY },
      });
      expect(typed.json()).toEqual({ lists: [{ id: "7", name: "Customers" }] });

      expect(
        (
          await asOwner({
            method: "POST",
            url: "/newsletter/lists",
            payload: { provider: "brevo" },
          })
        ).json().code,
      ).toBe("NEWSLETTER_KEY_NEEDED");

      await connectMailchimp();
      const saved = await asOwner({
        method: "POST",
        url: "/newsletter/lists",
        payload: { provider: "mailchimp" },
      });
      expect(saved.json().lists).toEqual([{ id: "abc123", name: "Bakery news" }]);
    });

    it("keeps the saved key when only the other settings change", async () => {
      await connectMailchimp();
      const response = await asOwner({
        method: "PUT",
        url: "/newsletter/connection",
        payload: { provider: "mailchimp", listId: "abc123", doubleOptIn: false },
      });
      expect(response.json()).toMatchObject({ connected: true, doubleOptIn: false });
    });

    it("needs Brevo's template and page for double opt-in", async () => {
      const response = await asOwner({
        method: "PUT",
        url: "/newsletter/connection",
        payload: { provider: "brevo", apiKey: BREVO_KEY, listId: "7", doubleOptIn: true },
      });
      expect(response.json().code).toBe("NEWSLETTER_BREVO_TEMPLATE_NEEDED");
    });

    it("is for people who can change settings", async () => {
      const asEditor = await lintel.signInWith(["entries:read", "settings:read"]);
      expect((await asEditor({ method: "GET", url: "/newsletter/connection" })).statusCode).toBe(
        200,
      );
      expect((await asEditor({ method: "DELETE", url: "/newsletter/connection" })).statusCode).toBe(
        403,
      );
    });
  });

  describe("signing up", () => {
    it("asks Mailchimp to send a confirmation email with double opt-in", async () => {
      await connectMailchimp(true);
      calls.length = 0;
      const response = await signUp({ email: "Ada@Example.com", name: "Ada", consent: "on" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        message: "Nearly there. Check your inbox and confirm your email address.",
      });
      expect(calls).toEqual([
        expect.objectContaining({
          method: "PUT",
          url: `https://us21.api.mailchimp.com/3.0/lists/abc123/members/${mailchimpMemberId("ada@example.com")}`,
          body: {
            email_address: "Ada@Example.com",
            status_if_new: "pending",
            merge_fields: { FNAME: "Ada" },
          },
        }),
      ]);
    });

    it("signs people straight up when double opt-in is off", async () => {
      await connectMailchimp(false);
      calls.length = 0;
      const response = await signUp({ email: "ada@example.com", consent: true });
      expect(response.json().message).toBe("Thanks, you're signed up.");
      expect(calls[0]?.body).toEqual({
        email_address: "ada@example.com",
        status_if_new: "subscribed",
      });
    });

    it("uses Brevo's confirmation email, or adds the contact straight away", async () => {
      await asOwner({
        method: "PUT",
        url: "/newsletter/connection",
        payload: {
          provider: "brevo",
          apiKey: BREVO_KEY,
          listId: "7",
          doubleOptIn: true,
          brevoTemplateId: 12,
          brevoConfirmUrl: "https://bakery.test/thanks",
        },
      });
      calls.length = 0;
      await signUp({ email: "ada@example.com", consent: "on" });
      expect(calls[0]).toMatchObject({
        url: "https://api.brevo.com/v3/contacts/doubleOptinConfirmation",
        headers: { "api-key": BREVO_KEY },
        body: {
          email: "ada@example.com",
          includeListIds: [7],
          templateId: 12,
          redirectionUrl: "https://bakery.test/thanks",
        },
      });

      await asOwner({
        method: "PUT",
        url: "/newsletter/connection",
        payload: { provider: "brevo", listId: "7", doubleOptIn: false },
      });
      calls.length = 0;
      const response = await signUp({ email: "ada@example.com", consent: "on" });
      expect(response.json().message).toBe("Thanks, you're signed up.");
      expect(calls[0]).toMatchObject({
        url: "https://api.brevo.com/v3/contacts",
        body: { email: "ada@example.com", listIds: [7], updateEnabled: true },
      });
    });

    it("explains what to fix, in words for visitors", async () => {
      await connectMailchimp();
      expect((await signUp({ email: "", consent: "on" })).json().message).toBe(
        "Please type your email address.",
      );
      expect((await signUp({ email: "ada@", consent: "on" })).json().message).toBe(
        "That email address doesn't look right. Check it and try again.",
      );
      const noConsent = await signUp({ email: "ada@example.com" });
      expect(noConsent.statusCode).toBe(400);
      expect(noConsent.json().message).toBe(
        "Please tick the box to say you'd like the newsletter.",
      );
      signUpStatus = 400;
      expect((await signUp({ email: "ada@example.com", consent: "on" })).json().message).toBe(
        "That email address couldn't be signed up. Check it and try again.",
      );
    });

    it("thanks robots that fill in the hidden field, and signs nobody up", async () => {
      await connectMailchimp();
      calls.length = 0;
      const response = await signUp({ email: "bot@example.com", consent: "on", website: "spam" });
      expect(response.statusCode).toBe(200);
      expect(calls).toEqual([]);
    });

    it("says sign-ups aren't open until a service is connected", async () => {
      const response = await signUp({ email: "ada@example.com", consent: "on" });
      expect(response.statusCode).toBe(503);
      expect(response.json().message).toBe("Sign-ups aren't open yet. Please try again later.");
    });

    it("says when the service can't be reached", async () => {
      await connectMailchimp();
      servicesDown = true;
      const response = await signUp({ email: "ada@example.com", consent: "on" });
      expect(response.statusCode).toBe(502);
      expect(response.json().message).toBe(
        "Mailchimp couldn't be reached just now. Try again in a minute.",
      );
    });

    it("answers a plain form post with a short page", async () => {
      await connectMailchimp();
      const response = await lintel.server.inject({
        method: "POST",
        url: SUBSCRIBE,
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "text/html",
          referer: "https://bakery.test/news",
        },
        payload: "email=ada%40example.com&consent=on&website=",
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/html");
      expect(response.body).toContain("Check your inbox");
      expect(response.body).toContain('<a href="https://bakery.test/news">Go back</a>');
    });

    it("signs up people who tick a form's newsletter box", async () => {
      await connectMailchimp();
      calls.length = 0;
      await lintel.server.events.publish("form.submitted", {
        form: { id: "form-1", handle: "contact", name: "Contact" },
        submission: {
          id: "submission-1",
          fields: { name: "Ada", email: "ada@example.com", newsletter: true },
          submitterEmail: "ada@example.com",
        },
      });
      expect(calls[0]?.body).toMatchObject({ email_address: "ada@example.com" });

      calls.length = 0;
      await lintel.server.events.publish("form.submitted", {
        form: { id: "form-1", handle: "contact", name: "Contact" },
        submission: {
          id: "submission-2",
          fields: { email: "bo@example.com", newsletter: false },
          submitterEmail: "bo@example.com",
        },
      });
      expect(calls).toEqual([]);
    });

    it("isn't there while the add-on is switched off", async () => {
      await connectMailchimp();
      await lintel.setEnabledPlugins([]);
      expect((await signUp({ email: "ada@example.com", consent: "on" })).statusCode).toBe(404);
    });
  });

  describe("on the website", () => {
    it("draws the form in templates, escaping what it's given", async () => {
      const html = await lintel.renderLiquid(
        '{% newsletter_signup heading: "Fresh <bread>", button: "Join" %}',
      );
      expect(html).toContain('<h2 class="newsletter-heading">Fresh &lt;bread&gt;</h2>');
      expect(html).toContain('action="/_lintel/api/addons/newsletter/subscribe"');
      expect(html).toContain('name="consent" type="checkbox" required');
      expect(html).toContain('<button class="newsletter-button" type="submit">Join</button>');
      expect(html).toContain('role="status" aria-live="polite"');
    });

    it("offers the sign-up element in the builder", async () => {
      const blocks = (await asOwner({ method: "GET", url: "/blocks" })).json().blocks;
      expect(blocks.map((block: { handle: string }) => block.handle)).toContain(
        "newsletter_signup",
      );
    });

    it("draws nothing in templates while it is switched off", async () => {
      await lintel.setEnabledPlugins([]);
      expect(await lintel.renderLiquid("[{% newsletter_signup %}]")).toBe("[]");
    });
  });
});

describe("Mailchimp keys", () => {
  it("name their data centre", () => {
    expect(mailchimpDataCentre(MAILCHIMP_KEY)).toBe("us21");
    expect(() => mailchimpDataCentre("abc")).toThrow("such as -us21");
  });
});
