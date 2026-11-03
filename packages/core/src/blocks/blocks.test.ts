import { createEmptyPage, type PageDocument, type PageNode } from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { definePlugin } from "../plugins/plugin-definition.js";
import { writeSetting } from "../settings/settings.service.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { image, text, toggle } from "../content-model-sync/field-helpers.js";
import { loadBlockPageData } from "./block-rendering.js";
import { defineBlock } from "./block-definition.js";
import { blockFromDefinition } from "./define-block.js";
import { drawPageDesign } from "../website/designed-pages.js";

/** The Team card from the spec: a photo, a name, a role and a LinkedIn link that can be hidden. */
const teamCardDesign = {
  id: "card",
  type: "box",
  name: "Team card",
  styles: { base: { backgroundColor: "#ffffff" } },
  children: [
    {
      id: "photo",
      type: "image",
      name: "Photo",
      props: { src: "/placeholder.jpg" },
      bindings: { src: "photo" },
    },
    {
      id: "name",
      type: "heading",
      name: "Name",
      props: { text: "Your name", level: 3 },
      bindings: { text: "name" },
    },
    {
      id: "role",
      type: "text",
      name: "Role",
      props: { text: "What you do" },
      bindings: { text: "role" },
    },
    {
      id: "linkedin",
      type: "button",
      name: "LinkedIn",
      props: { label: "LinkedIn", href: "https://linkedin.com" },
      bindings: { visible: "show_linkedin" },
    },
  ],
};

const teamCardProperties = [
  { handle: "name", label: "Name", type: "text", required: true },
  { handle: "photo", label: "Photo", type: "image" },
  { handle: "role", label: "Role", type: "text", validation: { maxLength: 40 } },
  { handle: "show_linkedin", label: "Show LinkedIn", type: "toggle", default: true },
];

function pageWith(children: unknown[]): PageDocument {
  const page = createEmptyPage();
  return { ...page, root: { ...page.root, children: children as PageNode[] } };
}

function instance(id: string, values: Record<string, unknown>) {
  return { id, type: "customBlock", name: "Team card", props: { block: "team_card", values } };
}

describe("the site's blocks", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let designer: SendRequest;
  let editor: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await ensurePagesCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "designer@example.com", [["*"]]);
    await createTestUser(testDatabase.database, "editor@example.com", [
      ["entries:*", "builder:design", "blueprints:read"],
    ]);
    designer = requestsAs(server, await signInAndGetCookies(server, "designer@example.com"));
    editor = requestsAs(server, await signInAndGetCookies(server, "editor@example.com"));
  });

  afterEach(() => server.close());

  async function makeTeamCard() {
    const response = await designer("POST", "/blocks", {
      name: "Team card",
      icon: "users",
      category: "Team",
      properties: teamCardProperties,
      design: teamCardDesign,
    });
    expect(response.statusCode).toBe(201);
    return response.json();
  }

  async function savePage(send: SendRequest, title: string, children: unknown[]) {
    return send("POST", "/collections/pages/entries", {
      data: { title, design: pageWith(children) },
    });
  }

  it("makes a block from a design, with a handle from its name, for anyone to use", async () => {
    const block = await makeTeamCard();
    expect(block).toMatchObject({
      handle: "team_card",
      source: "site",
      editable: true,
      usedOn: [],
    });
    expect(block.properties.map((property: { type: string }) => property.type)).toEqual([
      "text",
      "image",
      "text",
      "toggle",
    ]);
    const listed = (await editor("GET", "/blocks")).json();
    expect(listed.blocks.map((listedBlock: { name: string }) => listedBlock.name)).toEqual([
      "Team card",
    ]);
    const refused = await editor("POST", "/blocks", { name: "Mine", design: teamCardDesign });
    expect(refused.statusCode).toBe(403);
    expect(
      (
        await designer("POST", "/blocks", { name: "Team card", design: { id: "x", type: "box" } })
      ).json().handle,
    ).toBe("team_card_2");
  });

  it("checks a design's bindings point at properties of the right kind", async () => {
    const wrongKind = await designer("POST", "/blocks", {
      name: "Broken",
      properties: [{ handle: "name", label: "Name", type: "text" }],
      design: { id: "b", type: "box", bindings: { visible: "name" } },
    });
    expect(wrongKind.statusCode).toBe(400);
    expect(wrongKind.json().fields.design).toMatch(/toggle/);
    const missing = await designer("POST", "/blocks", {
      name: "Broken",
      design: { id: "b", type: "heading", bindings: { text: "title" } },
    });
    expect(missing.json().fields.design).toMatch(/isn’t one of the block’s properties/);
    const nested = await designer("POST", "/blocks", {
      name: "Nested",
      design: { id: "b", type: "box", children: [instance("i", {})] },
    });
    expect(nested.json().fields.design).toMatch(/can’t have another block inside/);
    const notAProperty = await designer("POST", "/blocks", {
      name: "Pages",
      properties: [{ handle: "inner", label: "Inner", type: "page" }],
      design: { id: "b", type: "box" },
    });
    expect(notAProperty.json().fields.inner).toMatch(/can't be a page design/);
  });

  it("checks every instance's values on save, with the same rules as an entry's fields", async () => {
    await makeTeamCard();
    const tooLong = await savePage(editor, "About", [
      instance("i1", { name: "Ada", role: "x".repeat(41) }),
    ]);
    expect(tooLong.statusCode).toBe(400);
    expect(tooLong.json().fields.design).toBe(
      "Design: Team card 1: Role can be at most 40 characters",
    );

    const draft = await savePage(editor, "About", [
      instance("i1", { role: "Engineer", stray: "dropped" }),
    ]);
    expect(draft.statusCode).toBe(201);
    const stored = draft.json().data.design.root.children[0].props.values;
    expect(stored).toEqual({ name: null, photo: null, role: "Engineer", show_linkedin: null });

    const publish = await editor("POST", `/entries/${draft.json().id}/publish`);
    expect(publish.statusCode).toBe(400);
    expect(JSON.stringify(publish.json())).toContain("Name is required");

    const unknown = await savePage(editor, "Other", [
      { ...instance("i2", {}), props: { block: "nope", values: {} } },
    ]);
    expect(unknown.json().fields.design).toMatch(/no “nope” block/);
  });

  it("draws every page with the block's current design, so changing it changes them all", async () => {
    await makeTeamCard();
    const about = (
      await savePage(editor, "About", [instance("ada", { name: "Ada", show_linkedin: false })])
    ).json();
    const team = (await savePage(editor, "Team", [instance("grace", { name: "Grace" })])).json();

    const draw = async (entry: { data: { design: PageDocument } }) => {
      const document = entry.data.design;
      const data = await loadBlockPageData(testDatabase.database, document.root, undefined);
      return drawPageDesign(document, data);
    };
    expect((await draw(about)).html).toContain("Ada");
    expect((await draw(about)).html).not.toContain("LinkedIn");
    expect((await draw(team)).html).toContain("LinkedIn");

    const changed = await designer("PUT", "/blocks/team_card", {
      name: "Team card",
      properties: teamCardProperties,
      design: { ...teamCardDesign, styles: { base: { backgroundColor: "#123456" } } },
    });
    expect(changed.statusCode).toBe(200);
    expect((await draw(about)).css).toContain("#123456");
    expect((await draw(team)).css).toContain("#123456");
    const usedOn = changed.json().usedOn.map((page: { title: string }) => page.title);
    expect(usedOn.sort()).toEqual(["About", "Team"]);
  });

  it("moves values to a renamed property, and warns before removing one pages filled in", async () => {
    await makeTeamCard();
    const about = (
      await savePage(editor, "About", [instance("ada", { name: "Ada", role: "Engineer" })])
    ).json();

    const renamed = teamCardProperties.map((property) =>
      property.handle === "name" ? { ...property, handle: "full_name" } : property,
    );
    const renaming = await designer("PUT", "/blocks/team_card", {
      name: "Team card",
      properties: renamed,
      design: teamCardDesign,
      renamedProperties: { name: "full_name" },
    });
    expect(renaming.statusCode).toBe(200);
    expect(renaming.json().design.children[1].bindings).toEqual({ text: "full_name" });
    expect(renaming.json().renamedProperties).toEqual({ name: "full_name" });
    const moved = (await editor("GET", `/entries/${about.id}`)).json();
    expect(moved.data.design.root.children[0].props.values).toMatchObject({ full_name: "Ada" });

    const withoutRole = renamed.filter((property) => property.handle !== "role");
    const designWithoutRole = {
      ...teamCardDesign,
      children: teamCardDesign.children.map((child) => {
        if (child.id === "name") return { ...child, bindings: { text: "full_name" } };
        return child.id === "role"
          ? Object.fromEntries(Object.entries(child).filter(([key]) => key !== "bindings"))
          : child;
      }),
    };
    const removing = await designer("PUT", "/blocks/team_card", {
      name: "Team card",
      properties: withoutRole,
      design: designWithoutRole,
    });
    expect(removing.statusCode).toBe(409);
    expect(removing.json()).toMatchObject({
      code: "BLOCK_CHANGE_NEEDS_CONFIRMATION",
      removedProperties: ["role"],
      pages: [expect.objectContaining({ title: "About" })],
    });
    const confirmed = await designer("PUT", "/blocks/team_card", {
      name: "Team card",
      properties: withoutRole,
      design: designWithoutRole,
      confirmRemovals: true,
    });
    expect(confirmed.statusCode).toBe(200);
  });

  it("won't delete a block in use unless its instances become plain elements", async () => {
    await makeTeamCard();
    const about = (await savePage(editor, "About", [instance("ada", { name: "Ada" })])).json();
    const refused = await designer("DELETE", "/blocks/team_card");
    expect(refused.statusCode).toBe(409);
    expect(refused.json().code).toBe("BLOCK_IN_USE");
    expect(refused.json().pages).toEqual([expect.objectContaining({ title: "About" })]);

    expect((await designer("DELETE", "/blocks/team_card?convert=true")).statusCode).toBe(204);
    const plain = (await editor("GET", `/entries/${about.id}`)).json().data.design.root.children[0];
    expect(plain.type).toBe("box");
    expect(plain.children.find((child: PageNode) => child.name === "Name").props.text).toBe("Ada");
    expect((await editor("GET", "/blocks/team_card")).statusCode).toBe(404);
  });

  it("offers a block in a content type's blocks field, with its properties as the fields", async () => {
    await makeTeamCard();
    const blueprint = await designer("POST", "/blueprints", {
      handle: "landing",
      name: "Landing page",
      fields: [
        { handle: "title", label: "Title", type: "text", required: true },
        {
          handle: "sections",
          label: "Sections",
          type: "blocks",
          options: { blockTypes: [{ handle: "anything", name: "Anything", block: "team_card" }] },
        },
      ],
    });
    expect(blueprint.statusCode).toBe(201);
    const blockType = blueprint.json().fields[1].options.blockTypes[0];
    expect(blockType).toMatchObject({ handle: "team_card", name: "Team card", block: "team_card" });
    expect(blockType.fields.map((field: { handle: string }) => field.handle)).toEqual([
      "name",
      "photo",
      "role",
      "show_linkedin",
    ]);
    await designer("POST", "/collections", {
      handle: "landings",
      name: "Landings",
      blueprintHandle: "landing",
      structure: "flat",
    });

    const tooLong = await editor("POST", "/collections/landings/entries", {
      data: {
        title: "Hello",
        sections: [{ id: "b1", type: "team_card", data: { name: "Ada", role: "x".repeat(41) } }],
      },
    });
    expect(tooLong.statusCode).toBe(400);
    expect(tooLong.json().fields["sections.b1.role"]).toBe("Role can be at most 40 characters");
    const saved = await editor("POST", "/collections/landings/entries", {
      data: { title: "Hello", sections: [{ id: "b1", type: "team_card", data: { name: "Ada" } }] },
    });
    expect(saved.statusCode).toBe(201);

    await designer("PUT", "/blocks/team_card", {
      name: "Team card",
      properties: [...teamCardProperties, { handle: "email", label: "Email", type: "email" }],
      design: teamCardDesign,
    });
    const refreshed = (await designer("GET", "/blueprints/landing")).json();
    expect(refreshed.fields[1].options.blockTypes[0].fields).toHaveLength(5);
    expect((await designer("GET", "/blocks/team_card")).json()).toMatchObject({
      usedIn: ["Landing page"],
      usedOn: [expect.objectContaining({ title: "Hello" })],
    });
  });
});

describe("blocks in code and from plugins", () => {
  const testDatabase = useTestDatabase();

  it("checks a code block's properties and template", () => {
    const block = blockFromDefinition(
      defineBlock({
        name: "Quote",
        properties: { words: text({ required: true }), who: text() },
        render: "<blockquote>{{words}}<cite>{{who}}</cite></blockquote>",
      }),
      "quote",
      "code",
    );
    expect(block).toMatchObject({
      handle: "quote",
      source: "code",
      template: expect.stringContaining("{{words}}"),
    });
    expect(() =>
      blockFromDefinition(
        defineBlock({ name: "Bad", render: "<p>{{missing}}</p>" }),
        "bad",
        "code",
      ),
    ).toThrow(/Some fields need attention|missing/);
  });

  it("offers a plugin's blocks while the plugin is on, drawn by the server", async () => {
    const plugin = definePlugin({
      id: "team-tools",
      name: "Team tools",
      description: "Blocks for team pages.",
      blocks: [
        defineBlock<{ name: string | null; photo: unknown; show_badge: boolean | null }>({
          handle: "team_tools_badge",
          name: "Badge",
          properties: { name: text(), photo: image(), show_badge: toggle() },
          // A component may give back plain text; React escapes it.
          render: ({ properties }) => `Badge for ${properties.name ?? "someone"} & co`,
        }),
      ],
    });
    const server = await startTestServer(testDatabase.activeDatabase, { plugins: [plugin] });
    try {
      await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
      const api = requestsAs(server, await signInAndGetCookies(server, "admin@example.com"));
      expect((await api("GET", "/blocks")).json().blocks).toEqual([]);
      await writeSetting(testDatabase.database, "enabledPlugins", ["team-tools"]);
      const [badge] = (await api("GET", "/blocks")).json().blocks;
      expect(badge).toMatchObject({
        handle: "team_tools_badge",
        source: "plugin",
        editable: false,
      });
      const rendered = await api("POST", "/blocks/render", {
        instances: [{ id: "x", block: "team_tools_badge", values: { name: "Ada" } }],
      });
      expect(rendered.json().html).toEqual({ x: "Badge for Ada &amp; co" });
      expect(
        (await api("PUT", "/blocks/team_tools_badge", { name: "Mine", design: {} })).json().code,
      ).toBe("BLOCK_NOT_EDITABLE");
    } finally {
      await server.close();
    }
  });
});
