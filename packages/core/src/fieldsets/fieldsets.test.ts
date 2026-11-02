import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

const title = { handle: "title", label: "Title", type: "text", required: true };

describe("fieldsets, and conditions when entries are saved", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "admin@example.com"));
  });

  afterEach(() => server.close());

  it("shares a fieldset's fields with every content type that uses it", async () => {
    const created = await api("POST", "/fieldsets", {
      handle: "seo",
      name: "SEO",
      fields: [{ handle: "meta_title", label: "Meta title", type: "text" }],
    });
    expect(created.statusCode).toBe(201);

    const blueprint = await api("POST", "/blueprints", {
      handle: "article",
      name: "Article",
      fields: [
        title,
        { handle: "search", label: "Search", type: "fieldset", options: { fieldset: "seo" } },
      ],
    });
    expect(blueprint.statusCode).toBe(201);
    expect(blueprint.json().fields[1].options.fields).toEqual([
      expect.objectContaining({ handle: "meta_title" }),
    ]);

    await api("PUT", "/fieldsets/seo", {
      name: "SEO",
      fields: [
        { handle: "meta_title", label: "Meta title", type: "text" },
        { handle: "meta_description", label: "Meta description", type: "textarea" },
      ],
    });
    const updated = (await api("GET", "/blueprints/article")).json();
    expect(
      updated.fields[1].options.fields.map((field: { handle: string }) => field.handle),
    ).toEqual(["meta_title", "meta_description"]);
    expect((await api("GET", "/fieldsets/seo")).json().usedBy).toEqual(["Article"]);

    const refused = await api("DELETE", "/fieldsets/seo");
    expect(refused.statusCode).toBe(409);
    expect(refused.json().code).toBe("FIELDSET_IN_USE");
  });

  // LINTEL-DATA-003: renaming cta_label to cta_text in the fieldset emptied every entry's label.
  it("moves entries' values when a field in a fieldset is renamed", async () => {
    const link = { handle: "cta_url", label: "Link", type: "text" };
    await api("POST", "/fieldsets", {
      handle: "cta",
      name: "Call to action",
      fields: [{ handle: "cta_label", label: "Label", type: "text" }, link],
    });
    await api("POST", "/blueprints", {
      handle: "service",
      name: "Service",
      fields: [
        title,
        { handle: "button", label: "Button", type: "fieldset", options: { fieldset: "cta" } },
      ],
    });
    await api("POST", "/collections", {
      handle: "services",
      name: "Services",
      blueprintHandle: "service",
      structure: "flat",
    });
    const entry = (
      await api("POST", "/collections/services/entries", {
        data: { title: "Baking", button: { cta_label: "Book a class", cta_url: "/contact" } },
      })
    ).json();

    const renamed = await api("PUT", "/fieldsets/cta", {
      name: "Call to action",
      fields: [{ handle: "cta_text", label: "Label", type: "text" }, link],
      renames: [{ from: "cta_label", to: "cta_text" }],
    });
    expect(renamed.statusCode).toBe(200);
    await api("PATCH", `/entries/${entry.id}`, { data: { title: "Baking classes" } });

    expect((await api("GET", `/entries/${entry.id}`)).json().data.button).toEqual({
      cta_text: "Book a class",
      cta_url: "/contact",
    });
  });

  it("refuses a fieldset that doesn't exist, or one inside another", async () => {
    const missing = await api("POST", "/blueprints", {
      handle: "page_two",
      name: "Page",
      fields: [
        title,
        { handle: "search", label: "Search", type: "fieldset", options: { fieldset: "nope" } },
      ],
    });
    expect(missing.statusCode).toBe(400);
    expect(missing.json().fields).toEqual({
      search: 'There is no fieldset with the handle "nope"',
    });

    const nested = await api("POST", "/fieldsets", {
      handle: "outer",
      name: "Outer",
      fields: [{ handle: "inner", label: "Inner", type: "fieldset", options: { fieldset: "seo" } }],
    });
    expect(nested.statusCode).toBe(400);
  });

  it("skips validation for hidden fields and clears them when an entry is saved", async () => {
    await api("POST", "/blueprints", {
      handle: "venue_event",
      name: "Event",
      fields: [
        title,
        {
          handle: "format",
          label: "Format",
          type: "select",
          width: 50,
          options: {
            choices: [
              { value: "online", label: "Online" },
              { value: "venue", label: "Venue" },
            ],
          },
        },
        {
          handle: "stream_url",
          label: "Stream address",
          type: "url",
          required: true,
          width: 50,
          conditions: { rules: [{ field: "format", operator: "is", value: "online" }] },
        },
      ],
    });
    await api("POST", "/collections", {
      handle: "events",
      name: "Events",
      blueprintHandle: "venue_event",
      structure: "flat",
    });

    const draft = await api("POST", "/collections/events/entries", {
      data: { title: "Fair", format: "venue", stream_url: "https://example.com/live" },
    });
    expect(draft.statusCode).toBe(201);
    expect(draft.json().data.stream_url).toBeNull();
    const published = await api("POST", `/entries/${draft.json().id}/publish`);
    expect(published.statusCode).toBe(200);

    const online = await api("POST", "/collections/events/entries", {
      data: { title: "Talk", format: "online" },
    });
    const refused = await api("POST", `/entries/${online.json().id}/publish`);
    expect(refused.statusCode).toBe(400);
    expect(refused.json().fields).toEqual({ stream_url: "Stream address is required" });
  });
});
