import { createEmptyPage, type PageDocument } from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { builtInRoles, CLIENT_ROLE_HANDLE } from "../roles/built-in-roles.js";
import { hasPermission } from "../roles/permissions.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createPersonWithRole } from "../testing/test-people.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { signInAndGetCookies } from "../testing/test-users.js";

type Node = PageDocument["root"]["children"][number];

function pageWith(children: unknown[]): PageDocument {
  const page = createEmptyPage();
  return { ...page, root: { ...page.root, children: children as Node[] } };
}

const heading = { id: "h1", type: "heading", props: { text: "Fresh bread", level: 1 } };
const button = { id: "b1", type: "button", props: { label: "Order", href: "/order" } };
const card = (id: string, words: string) => ({
  id,
  type: "card",
  children: [{ id: `${id}-t`, type: "text", props: { text: words } }],
});
const cards = (repeats: boolean, items: unknown[]) => ({
  id: "list",
  type: "box",
  ...(repeats ? { clientRepeats: true } : {}),
  children: items,
});

describe("the Client (content only) role", () => {
  const role = builtInRoles.find((each) => each.handle === CLIENT_ROLE_HANDLE);

  it("edits content and uploads media, and nothing about the design or the site", () => {
    expect(role?.name).toBe("Client (content only)");
    const can = (permission: `${string}:${string}`) =>
      hasPermission(role?.permissions ?? [], permission);
    expect(can("entries:read")).toBe(true);
    expect(can("entries:update")).toBe(true);
    expect(can("entries:create")).toBe(true);
    expect(can("media:upload")).toBe(true);
    for (const refused of [
      "builder:design",
      "builder:blocks",
      "builder:code",
      "settings:update",
      "users:update",
      "collections:update",
      "blueprints:update",
      "entries:delete",
    ] as const) {
      expect(can(refused)).toBe(false);
    }
  });

  it("is the only built-in role that edits without designing", () => {
    const editsWithoutDesigning = builtInRoles.filter((each) =>
      hasPermission(each.permissions, "entries:update-own") ||
      hasPermission(each.permissions, "entries:update")
        ? !hasPermission(each.permissions, "builder:design")
        : false,
    );
    expect(editsWithoutDesigning.map((each) => each.handle)).toEqual([CLIENT_ROLE_HANDLE]);
  });
});

describe("content-only editing", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let owner: SendRequest;
  let editor: SendRequest;
  let client: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await ensurePagesCollection(testDatabase.database);
    await createPersonWithRole(testDatabase.database, "owner@example.com", "owner");
    await createPersonWithRole(testDatabase.database, "editor@example.com", "editor");
    await createPersonWithRole(testDatabase.database, "client@example.com", CLIENT_ROLE_HANDLE);
    owner = requestsAs(server, await signInAndGetCookies(server, "owner@example.com"));
    editor = requestsAs(server, await signInAndGetCookies(server, "editor@example.com"));
    client = requestsAs(server, await signInAndGetCookies(server, "client@example.com"));
  });

  afterEach(() => server.close());

  async function designedPage(design: PageDocument) {
    const created = await owner("POST", "/collections/pages/entries", {
      data: { title: "Home", design },
    });
    expect(created.statusCode).toBe(201);
    return created.json() as { id: string; data: { design: PageDocument } };
  }

  const save = (send: SendRequest, id: string, design: PageDocument) =>
    send("PATCH", `/entries/${id}`, { data: { design } });

  it("accepts new words and links from a client", async () => {
    const page = await designedPage(pageWith([heading, button]));
    const response = await save(
      client,
      page.id,
      pageWith([
        { ...heading, props: { ...heading.props, text: "Warm bread" } },
        { ...button, props: { ...button.props, label: "Buy", href: "/shop" } },
      ]),
    );
    expect(response.statusCode).toBe(200);
    expect(response.json().data.design.root.children[0].props.text).toBe("Warm bread");
  });

  it("refuses a style or layout change from a client, with a plain message", async () => {
    const page = await designedPage(pageWith([heading, button]));
    const styled = await save(
      client,
      page.id,
      pageWith([{ ...heading, styles: { base: { color: "red" } } }, button]),
    );
    expect(styled.statusCode).toBe(403);
    expect(styled.json().code).toBe("DESIGN_CHANGE_NOT_ALLOWED");
    expect(styled.json().message).toContain("not the design (Heading)");

    const moved = await save(client, page.id, pageWith([button, heading]));
    expect(moved.statusCode).toBe(403);
    const added = await save(client, page.id, pageWith([heading, button, { ...button, id: "b2" }]));
    expect(added.statusCode).toBe(403);
    const levelled = await save(
      client,
      page.id,
      pageWith([{ ...heading, props: { ...heading.props, level: 3 } }, button]),
    );
    expect(levelled.statusCode).toBe(403);

    // A designer may change anything, as before.
    const designer = await save(editor, page.id, pageWith([button, heading]));
    expect(designer.statusCode).toBe(200);
  });

  it("refuses a client's restore of a revision with a different design", async () => {
    const page = await designedPage(pageWith([heading, button]));
    expect((await save(editor, page.id, pageWith([button, heading]))).statusCode).toBe(200);
    const words = pageWith([button, { ...heading, props: { ...heading.props, text: "Rye" } }]);
    expect((await save(client, page.id, words)).statusCode).toBe(200);
    const listed = await client("GET", `/entries/${page.id}/revisions`);
    const revisions = listed.json().revisions as { id: string }[];
    const oldest = revisions[revisions.length - 1];
    const newest = revisions[0];

    const restored = await client("POST", `/entries/${page.id}/revisions/${oldest?.id}/restore`);
    expect(restored.statusCode).toBe(403);
    expect(restored.json().code).toBe("DESIGN_CHANGE_NOT_ALLOWED");

    // A revision with today's design (only the words differ) restores, and designers restore any.
    expect(
      (await client("POST", `/entries/${page.id}/revisions/${newest?.id}/restore`)).statusCode,
    ).toBe(200);
    expect(
      (await editor("POST", `/entries/${page.id}/revisions/${oldest?.id}/restore`)).statusCode,
    ).toBe(200);
  });

  it("refuses words where the designer said clients can change nothing", async () => {
    const page = await designedPage(pageWith([{ ...heading, clientEdits: [] }]));
    const response = await save(
      client,
      page.id,
      pageWith([{ ...heading, clientEdits: [], props: { ...heading.props, text: "Mine" } }]),
    );
    expect(response.statusCode).toBe(403);
  });

  it("lets a client add and remove items only where they may add more", async () => {
    const closed = await designedPage(pageWith([cards(false, [card("c1", "One")])]));
    const refused = await save(
      client,
      closed.id,
      pageWith([cards(false, [card("c1", "One"), card("c2", "Two")])]),
    );
    expect(refused.statusCode).toBe(403);

    const open = await designedPage(pageWith([cards(true, [card("c1", "One")])]));
    const added = await save(
      client,
      open.id,
      pageWith([cards(true, [card("c1", "One"), card("c2", "Two")])]),
    );
    expect(added.statusCode).toBe(200);
    const removed = await save(client, open.id, pageWith([cards(true, [card("c2", "Two")])]));
    expect(removed.statusCode).toBe(200);
    const emptied = await save(client, open.id, pageWith([cards(true, [])]));
    expect(emptied.statusCode).toBe(403);
  });

  it("keeps clients out of shared sections and the site's design", async () => {
    expect((await client("PUT", "/website/sections", {})).statusCode).toBe(403);
    expect((await client("PUT", "/website/design", {})).statusCode).toBe(403);
  });

  it("lets clients publish while their changes go live straight away", async () => {
    const page = await designedPage(pageWith([heading]));
    expect((await client("GET", "/client-editing/settings")).json()).toEqual({
      clientChanges: "goLive",
    });
    expect((await client("POST", `/entries/${page.id}/publish`)).statusCode).toBe(200);
    expect((await client("POST", `/entries/${page.id}/review`, {})).statusCode).toBe(400);
  });

  describe("while clients' changes wait for approval", () => {
    beforeEach(async () => {
      expect(
        (await client("PATCH", "/client-editing/settings", { clientChanges: "needsApproval" }))
          .statusCode,
      ).toBe(403);
      const changed = await owner("PATCH", "/client-editing/settings", {
        clientChanges: "needsApproval",
      });
      expect(changed.json()).toEqual({ clientChanges: "needsApproval" });
    });

    it("refuses a client's Publish and asks them to send it for review", async () => {
      const page = await designedPage(pageWith([heading]));
      const published = await client("POST", `/entries/${page.id}/publish`);
      expect(published.statusCode).toBe(403);
      expect(published.json().code).toBe("REVIEW_NEEDED");
      expect((await client("POST", `/entries/${page.id}/unpublish`)).statusCode).toBe(403);
      expect((await client("GET", `/entries/${page.id}/review`)).json()).toMatchObject({
        needsApproval: true,
        mustSendForReview: true,
        review: null,
      });
      // Designers still publish as they always have.
      expect((await editor("POST", `/entries/${page.id}/publish`)).statusCode).toBe(200);
    });

    it("sends for review, and approving publishes the client's changes", async () => {
      const page = await designedPage(pageWith([heading]));
      await save(
        client,
        page.id,
        pageWith([{ ...heading, props: { ...heading.props, text: "Warm bread" } }]),
      );
      const sent = await client("POST", `/entries/${page.id}/review`, { note: "New opening" });
      expect(sent.statusCode).toBe(201);
      expect(sent.json().review).toMatchObject({ status: "waiting", requestNote: "New opening" });
      expect((await client("POST", `/entries/${page.id}/review`, {})).statusCode).toBe(409);

      const waiting = (await editor("GET", "/client-reviews")).json().reviews;
      expect(waiting).toHaveLength(1);
      expect(waiting[0]).toMatchObject({
        entry: { id: page.id, title: "Home", collection: "pages" },
        requestedByName: "client",
      });

      // Clients can't approve their own changes.
      expect((await client("POST", `/client-reviews/${waiting[0].id}/approve`)).statusCode).toBe(
        403,
      );
      const approved = await editor("POST", `/client-reviews/${waiting[0].id}/approve`);
      expect(approved.statusCode).toBe(200);
      expect(approved.json()).toMatchObject({ status: "approved", decidedByName: "editor" });

      const live = (await owner("GET", `/entries/${page.id}/live`)).json();
      expect(live.data.design.root.children[0].props.text).toBe("Warm bread");
      expect((await editor("GET", "/client-reviews")).json().reviews).toEqual([]);
      expect((await editor("POST", `/client-reviews/${waiting[0].id}/approve`)).statusCode).toBe(
        409,
      );
    });

    it("sends changes back with a note, leaving the live page as it was", async () => {
      const page = await designedPage(pageWith([heading]));
      await owner("POST", `/entries/${page.id}/publish`);
      await save(
        client,
        page.id,
        pageWith([{ ...heading, props: { ...heading.props, text: "Typo heer" } }]),
      );
      const sent = (await client("POST", `/entries/${page.id}/review`, {})).json();
      const reviewId = sent.review.id as string;

      const noNote = await owner("POST", `/client-reviews/${reviewId}/send-back`, { note: " " });
      expect(noNote.statusCode).toBe(400);
      const back = await owner("POST", `/client-reviews/${reviewId}/send-back`, {
        note: "Check the spelling in the heading",
      });
      expect(back.json()).toMatchObject({
        status: "sentBack",
        decisionNote: "Check the spelling in the heading",
      });

      const state = (await client("GET", `/entries/${page.id}/review`)).json();
      expect(state.review).toMatchObject({ status: "sentBack", decidedByName: "owner" });
      const live = (await owner("GET", `/entries/${page.id}/live`)).json();
      expect(live.data.design.root.children[0].props.text).toBe("Fresh bread");
      // They can send it again once fixed.
      expect((await client("POST", `/entries/${page.id}/review`, {})).statusCode).toBe(201);
    });
  });
});
