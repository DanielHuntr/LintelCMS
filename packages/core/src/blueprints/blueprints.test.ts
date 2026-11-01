import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

const titleField = { handle: "title", label: "Title", type: "text", required: true };

const eventFields = [
  titleField,
  { handle: "starts", label: "Starts", type: "date", options: { includeTime: true } },
  {
    handle: "audience",
    label: "Audience",
    type: "select",
    helpText: "Who it's for",
    options: { choices: [{ value: "everyone", label: "Everyone" }] },
  },
];

describe("blueprints", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "admin@example.com"));
  });

  afterEach(() => server.close());

  it("creates a blueprint, filling in defaults for each field and its options", async () => {
    const response = await api("POST", "/blueprints", {
      handle: "event",
      name: "Event",
      fields: eventFields,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      handle: "event",
      name: "Event",
      kind: "entry",
      version: 1,
      fields: [
        {
          handle: "title",
          label: "Title",
          type: "text",
          required: true,
          helpText: "",
          options: {},
        },
        { handle: "starts", type: "date", required: false, options: { includeTime: true } },
        {
          handle: "audience",
          helpText: "Who it's for",
          options: { choices: [{ value: "everyone", label: "Everyone" }], multiple: false },
        },
      ],
    });
    expect(response.json().updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const list = await api("GET", "/blueprints");
    expect(list.json().blueprints.map((blueprint: { handle: string }) => blueprint.handle)).toEqual(
      ["event"],
    );
    expect((await api("GET", "/blueprints/event")).json().id).toBe(response.json().id);
    expect((await api("GET", "/blueprints/missing")).json()).toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
  });

  it("needs a required Text field called title, first; it can be relabelled", async () => {
    const withoutTitle = await api("POST", "/blueprints", {
      handle: "event",
      name: "Event",
      fields: eventFields.slice(1),
    });
    const titleSecond = await api("POST", "/blueprints", {
      handle: "event",
      name: "Event",
      fields: [eventFields[1], titleField],
    });
    const titleNotText = await api("POST", "/blueprints", {
      handle: "event",
      name: "Event",
      fields: [{ ...titleField, type: "textarea" }],
    });
    const relabelled = await api("POST", "/blueprints", {
      handle: "event",
      name: "Event",
      fields: [{ handle: "title", label: "Event name", type: "text", required: false }],
    });

    expect(withoutTitle.statusCode).toBe(400);
    expect(withoutTitle.json()).toMatchObject({
      code: "INVALID_REQUEST",
      fields: {
        title:
          "Every content type needs a Title field (handle “title”). It can be renamed but not removed.",
      },
    });
    expect(titleSecond.json().fields).toEqual({ title: "The Title field has to come first" });
    expect(titleNotText.json().fields).toEqual({ title: "The Title field has to be a Text field" });
    expect(relabelled.statusCode).toBe(201);
    expect(relabelled.json().fields[0]).toMatchObject({ label: "Event name", required: true });
  });

  it("reports every field problem at once, keyed by field handle", async () => {
    const response = await api("POST", "/blueprints", {
      handle: "event",
      name: "Event",
      fields: [
        titleField,
        { handle: "Starts At", label: "Starts", type: "date" },
        { handle: "price", label: "Price", type: "money" },
        { handle: "seats", label: "Seats", type: "number", options: { min: 10, max: 1 } },
        { handle: "audience", label: "Audience", type: "select", options: { choices: [] } },
        { handle: "seats", label: "Seats again", type: "number" },
        { label: "No handle", type: "text" },
      ],
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().fields).toEqual({
      "Starts At":
        "Handles use lowercase letters, numbers and underscores, and start with a letter",
      price:
        "The type should be one of: text, textarea, richText, number, toggle, select, date, image, link, blocks",
      seats: "The minimum can't be more than the maximum",
      audience: "A select field needs at least one choice",
      "field 7": "Each field needs a handle",
    });
  });

  it("checks the blueprint's own handle and refuses one already taken", async () => {
    await api("POST", "/blueprints", { handle: "event", name: "Event", fields: [titleField] });

    const taken = await api("POST", "/blueprints", {
      handle: "event",
      name: "Other",
      fields: [titleField],
    });
    const badHandle = await api("POST", "/blueprints", {
      handle: "1-event",
      name: "Event",
      fields: [titleField],
    });

    expect(taken.statusCode).toBe(409);
    expect(taken.json().code).toBe("BLUEPRINT_HANDLE_TAKEN");
    expect(badHandle.statusCode).toBe(400);
    expect(badHandle.json().message).toContain("Handles use lowercase letters");
  });

  it("bumps the version on every update and keeps the handle", async () => {
    await api("POST", "/blueprints", { handle: "event", name: "Event", fields: eventFields });

    const first = await api("PUT", "/blueprints/event", {
      name: "Events",
      fields: eventFields.slice(0, 2),
    });
    const second = await api("PUT", "/blueprints/event", { name: "Events", fields: [titleField] });

    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ handle: "event", name: "Events", version: 2 });
    expect(first.json().fields).toHaveLength(2);
    expect(second.json().version).toBe(3);
    expect(
      (await api("PUT", "/blueprints/event", { name: "Events", fields: [] })).json().fields,
    ).toHaveProperty("title");
  });

  it("deletes an unused blueprint, and refuses one a collection uses", async () => {
    await api("POST", "/blueprints", { handle: "event", name: "Event", fields: [titleField] });
    await api("POST", "/blueprints", { handle: "unused", name: "Unused", fields: [titleField] });
    await api("POST", "/collections", {
      handle: "events",
      name: "Events",
      blueprintHandle: "event",
      structure: "dated",
    });

    const inUse = await api("DELETE", "/blueprints/event");
    const unused = await api("DELETE", "/blueprints/unused");

    expect(inUse.statusCode).toBe(409);
    expect(inUse.json()).toMatchObject({ code: "BLUEPRINT_IN_USE" });
    expect(inUse.json().message).toContain("Events");
    expect(unused.statusCode).toBe(204);
    expect((await api("GET", "/blueprints/unused")).statusCode).toBe(404);
  });

  it("needs blueprints:read to look and blueprints:update to change", async () => {
    await createTestUser(testDatabase.database, "reader@example.com", [["blueprints:read"]]);
    const reader = requestsAs(server, await signInAndGetCookies(server, "reader@example.com"));

    expect((await server.inject({ method: "GET", url: "/blueprints" })).statusCode).toBe(401);
    expect((await reader("GET", "/blueprints")).statusCode).toBe(200);
    const create = await reader("POST", "/blueprints", {
      handle: "event",
      name: "Event",
      fields: [titleField],
    });
    expect(create.statusCode).toBe(403);
    expect(create.json().message).toContain("blueprints:update");
  });
});
