import { createEmptyPage, type PageDocument, type PageNode } from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { CLIENT_ROLE_HANDLE } from "../roles/built-in-roles.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createPersonWithRole } from "../testing/test-people.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { signInAndGetCookies } from "../testing/test-users.js";
import { drawPageDesign } from "../website/designed-pages.js";
import { loadBlockPageData } from "./block-rendering.js";

/** A button component: a box with an icon and a label the editor fills in. */
const buttonDesign = {
  id: "box",
  type: "box",
  name: "Button",
  styles: { base: { paddingTop: "12px", backgroundColor: "#111111" } },
  children: [
    { id: "icon", type: "icon", name: "Icon", props: { name: "arrow-right" } },
    {
      id: "label",
      type: "text",
      name: "Label",
      props: { text: "Read more" },
      bindings: { text: "label" },
    },
  ],
};

const variants = {
  properties: [
    {
      handle: "size",
      label: "Size",
      options: [
        { value: "small", label: "Small" },
        { value: "medium", label: "Medium" },
        { value: "large", label: "Large" },
      ],
      default: "medium",
    },
    {
      handle: "icon",
      label: "Icon",
      options: [
        { value: "on", label: "On" },
        { value: "off", label: "Off" },
      ],
      default: "on",
    },
  ],
  looks: [
    { when: { size: "small" }, elements: { box: { styles: { base: { paddingTop: "6px" } } } } },
    { when: { icon: "off" }, elements: { icon: { hidden: true } } },
  ],
  clientsMayChoose: false,
};

const properties = [{ handle: "label", label: "Label", type: "text" }];

function pageWith(children: unknown[]): PageDocument {
  const page = createEmptyPage();
  return { ...page, root: { ...page.root, children: children as PageNode[] } };
}

function instance(id: string, variant?: Record<string, string>) {
  return {
    id,
    type: "customBlock",
    name: "Button",
    props: { block: "button", values: { label: "Order" }, ...(variant ? { variant } : {}) },
  };
}

describe("components with variants", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let owner: SendRequest;
  let client: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await ensurePagesCollection(testDatabase.database);
    await createPersonWithRole(testDatabase.database, "owner@example.com", "owner");
    await createPersonWithRole(testDatabase.database, "client@example.com", CLIENT_ROLE_HANDLE);
    owner = requestsAs(server, await signInAndGetCookies(server, "owner@example.com"));
    client = requestsAs(server, await signInAndGetCookies(server, "client@example.com"));
  });

  afterEach(() => server.close());

  async function makeButton(withVariants: unknown = variants) {
    return owner("POST", "/blocks", {
      name: "Button",
      properties,
      design: buttonDesign,
      variants: withVariants,
    });
  }

  it("keeps a component's variants, and gives older ones none", async () => {
    const made = await makeButton();
    expect(made.statusCode).toBe(201);
    expect(made.json().variants.properties.map((each: { handle: string }) => each.handle)).toEqual([
      "size",
      "icon",
    ]);
    const plain = await owner("POST", "/blocks", {
      name: "Card",
      properties: [],
      design: { ...buttonDesign, id: "card", children: [] },
    });
    expect(plain.json().variants).toEqual({ properties: [], looks: [], clientsMayChoose: false });
    // Saving the design without sending variants keeps them.
    const saved = await owner("PUT", "/blocks/button", {
      name: "Button",
      properties,
      design: buttonDesign,
    });
    expect(saved.json().variants.looks).toHaveLength(2);
  });

  it("refuses variants that don't fit the component, with a plain message", async () => {
    const twice = await makeButton({
      ...variants,
      properties: [variants.properties[0], variants.properties[0]],
    });
    expect(twice.statusCode).toBe(400);
    expect(twice.json().fields.variants).toBe("Two variants are called “size”");
    const badDefault = await makeButton({
      ...variants,
      properties: [{ ...variants.properties[0], default: "huge" }],
      looks: [],
    });
    expect(badDefault.json().fields.variants).toMatch(/isn’t one of its choices/);
    const strayElement = await makeButton({
      ...variants,
      looks: [{ when: { size: "small" }, elements: { gone: { hidden: true } } }],
    });
    expect(strayElement.json().fields.variants).toMatch(/doesn’t have/);
    const oneChoice = await makeButton({
      properties: [
        { handle: "size", label: "Size", options: [{ value: "a", label: "A" }], default: "a" },
      ],
    });
    expect(oneChoice.json().fields.variants).toMatch(/at least two choices/);
  });

  it("stores only an instance's choices that differ, and draws each variant", async () => {
    await makeButton();
    const saved = await owner("POST", "/collections/pages/entries", {
      data: {
        title: "Home",
        design: pageWith([
          instance("a", { size: "small", icon: "on" }),
          instance("b", { size: "gigantic", icon: "off", stray: "x" }),
        ]),
      },
    });
    expect(saved.statusCode).toBe(201);
    const [first, second] = saved.json().data.design.root.children;
    expect(first.props.variant).toEqual({ size: "small" });
    expect(second.props.variant).toEqual({ icon: "off" });

    const document = saved.json().data.design as PageDocument;
    const data = await loadBlockPageData(testDatabase.database, document.root, undefined);
    const drawn = drawPageDesign(document, data);
    expect(drawn.css).toContain("6px");
    expect(drawn.html).toContain("Order");
  });

  it("lets clients fill in a component's properties, and choose variants only when allowed", async () => {
    await makeButton();
    const page = (
      await owner("POST", "/collections/pages/entries", {
        data: { title: "Home", design: pageWith([instance("a")]) },
      })
    ).json();
    const save = (design: PageDocument) =>
      client("PATCH", `/entries/${page.id}`, { data: { design } });

    const filled = await save(
      pageWith([{ ...instance("a"), props: { block: "button", values: { label: "Buy" } } }]),
    );
    expect(filled.statusCode).toBe(200);

    const restyled = await save(pageWith([instance("a", { size: "large" })]));
    expect(restyled.statusCode).toBe(403);
    expect(restyled.json().code).toBe("DESIGN_CHANGE_NOT_ALLOWED");

    await owner("PUT", "/blocks/button", {
      name: "Button",
      properties,
      design: buttonDesign,
      variants: { ...variants, clientsMayChoose: true },
    });
    const allowed = await save(pageWith([instance("a", { size: "large" })]));
    expect(allowed.statusCode).toBe(200);
  });
});
