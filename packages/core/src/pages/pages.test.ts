import { createEmptyPage, type PageDocument } from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

function pageWith(children: unknown[]): PageDocument {
  const page = createEmptyPage();
  return {
    ...page,
    root: { ...page.root, children: children as PageDocument["root"]["children"] },
  };
}

const heading = { id: "h1", type: "heading", props: { text: "Welcome", level: 1 } };
const code = {
  id: "c1",
  type: "codeBlock",
  props: {
    html: '<div onclick="steal()"><h2 data-lintel-field="title">Hi</h2></div>',
    js: "steal()",
  },
};

describe("page designs", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let developer: SendRequest;
  let editor: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await ensurePagesCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "dev@example.com", [["*"]]);
    await createTestUser(testDatabase.database, "ed@example.com", [["entries:*", "settings:read"]]);
    developer = requestsAs(server, await signInAndGetCookies(server, "dev@example.com"));
    editor = requestsAs(server, await signInAndGetCookies(server, "ed@example.com"));
  });

  afterEach(() => server.close());

  async function createPage(send: SendRequest, design: unknown) {
    return send("POST", "/collections/pages/entries", { data: { title: "Home", design } });
  }

  it("stores a page design with its defaults filled in", async () => {
    const response = await createPage(editor, pageWith([heading]));
    expect(response.statusCode).toBe(201);
    expect(response.json().data.design.root.children[0]).toEqual({
      ...heading,
      name: "",
      styles: { base: {} },
      children: [],
      hidden: false,
      locked: false,
    });
  });

  it("stores an empty design as empty", async () => {
    const response = await createPage(editor, pageWith([]));
    expect(response.json().data.design).toBeNull();
  });

  it("refuses a design with a problem, naming the element", async () => {
    const response = await createPage(editor, pageWith([{ ...heading, props: { level: 8 } }]));
    expect(response.statusCode).toBe(400);
    expect(response.json().fields.design).toBe(
      "Design: Heading 1: A heading level should be a number from 1 to 6",
    );
  });

  it("lets only people with the code permission add code, and removes scripts", async () => {
    const refused = await createPage(editor, pageWith([code]));
    expect(refused.statusCode).toBe(400);
    expect(refused.json().fields.design).toContain("only people allowed to edit code");

    const created = await createPage(developer, pageWith([code]));
    expect(created.statusCode).toBe(201);
    const saved = created.json().data.design.root.children[0];
    expect(saved.props).toMatchObject({
      html: '<div><h2 data-lintel-field="title">Hi</h2></div>',
      js: "",
    });

    // Moving, duplicating and filling in the code block is fine for anyone.
    const filled = { ...saved, props: { ...saved.props, fields: { title: "Hello" } } };
    const copy = { ...filled, id: "c2" };
    const changed = await editor("PATCH", `/entries/${created.json().id}`, {
      data: { design: pageWith([copy, heading, filled]) },
    });
    expect(changed.statusCode).toBe(200);

    const rewritten = { ...saved, props: { ...saved.props, css: "body { display: none }" } };
    const refusedChange = await editor("PATCH", `/entries/${created.json().id}`, {
      data: { design: pageWith([rewritten]) },
    });
    expect(refusedChange.statusCode).toBe(400);
  });

  it("keeps scripts when the site allows them", async () => {
    const forbidden = await editor("PATCH", "/pages/settings", { customScripts: "allowScripts" });
    expect(forbidden.statusCode).toBe(403);
    const updated = await developer("PATCH", "/pages/settings", { customScripts: "allowScripts" });
    expect(updated.json()).toEqual({ customScripts: "allowScripts" });

    const created = await createPage(developer, pageWith([code]));
    expect(created.json().data.design.root.children[0].props.js).toBe("steal()");
    expect((await editor("GET", "/pages/settings")).json()).toEqual({
      customScripts: "allowScripts",
    });
  });
});
