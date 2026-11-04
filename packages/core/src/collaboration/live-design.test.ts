import type { AddressInfo } from "node:net";
import {
  createEmptyPage,
  findNode,
  type LiveClientMessage,
  type PageChange,
  type PageDocument,
} from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { findEntryById, updateEntryRow } from "../entries/entries.repository.js";
import { CLIENT_ROLE_HANDLE } from "../roles/built-in-roles.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createPersonWithRole } from "../testing/test-people.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { signInAndGetCookies } from "../testing/test-users.js";
import { connectAs, type TestBrowser } from "../testing/test-live-browser.js";
import { storeDesign } from "./live-design.service.js";

type Node = PageDocument["root"]["children"][number];

const field = "design";

function startingPage(): PageDocument {
  const page = createEmptyPage();
  const children = [
    { id: "hero", type: "heading", props: { text: "Fresh bread daily", level: 1 } },
    { id: "cta", type: "button", props: { label: "Order", href: "/order" } },
  ] as unknown as Node[];
  return { ...page, root: { ...page.root, children } };
}

interface SavedEntry {
  id: string;
  version: number;
  status: string;
  data: { design?: PageDocument; title?: string };
}

describe("editing a design together", () => {
  const database = useTestDatabase();
  let server: FastifyInstance;
  let address: string;
  let cookies: Record<"owner" | "editor" | "client" | "viewer", Record<string, string>>;
  let owner: SendRequest;
  let entryId: string;
  const open: TestBrowser[] = [];
  let batches = 0;

  /** A browser on the page with its design open. */
  async function inDesign(who: keyof typeof cookies, tab: string) {
    const browser = await connectAs(address, cookies[who]);
    open.push(browser);
    browser.send({ type: "enterPage", tab, entryId, view: "design" });
    browser.send({ type: "openDesign", tab, entryId, field });
    return { browser, opened: await browser.next("designOpened") };
  }

  const send = (browser: TestBrowser, tab: string, changes: PageChange[]) => {
    batches += 1;
    const batch = `batch-${batches}`;
    const message = { type: "changes", tab, entryId, field, batch, changes };
    browser.send(message as unknown as LiveClientMessage);
    return batch;
  };

  const rename = (node: string, value: string): PageChange => ({
    op: "set",
    node,
    path: ["name"],
    value,
  });

  const store = async (browser: TestBrowser, tab: string) => {
    browser.send({ type: "storeDesign", tab, entryId, field, request: "now" });
    return browser.next("designStored", (message) => message.request === "now");
  };

  const stored = async () => (await owner("GET", `/entries/${entryId}`)).json<SavedEntry>();

  beforeEach(async () => {
    server = await startTestServer(database.activeDatabase);
    await server.listen({ port: 0, host: "127.0.0.1" });
    address = `ws://127.0.0.1:${(server.server.address() as AddressInfo).port}`;
    const db = database.database;
    await ensurePagesCollection(db);
    await createPersonWithRole(db, "owner@example.com", "owner", "Olive Owner");
    await createPersonWithRole(db, "editor@example.com", "editor", "Ed Editor");
    await createPersonWithRole(db, "client@example.com", CLIENT_ROLE_HANDLE, "Clara Client");
    await createPersonWithRole(db, "viewer@example.com", "viewer", "Viv Viewer");
    cookies = {
      owner: await signInAndGetCookies(server, "owner@example.com"),
      editor: await signInAndGetCookies(server, "editor@example.com"),
      client: await signInAndGetCookies(server, "client@example.com"),
      viewer: await signInAndGetCookies(server, "viewer@example.com"),
    };
    owner = requestsAs(server, cookies.owner);
    const created = await owner("POST", "/collections/pages/entries", {
      data: { title: "Home", design: startingPage() },
    });
    expect(created.statusCode).toBe(201);
    entryId = created.json<SavedEntry>().id;
  });

  afterEach(async () => {
    for (const each of open.splice(0)) each.close();
    await server.close();
  });

  it("gives everyone the same page and both people's changes", async () => {
    const { browser: first, opened } = await inDesign("owner", "a");
    const { browser: second } = await inDesign("editor", "b");
    expect(opened.canEdit).toBe(true);
    expect(findNode(opened.document.root, "hero")?.props.text).toBe("Fresh bread daily");

    const batch = send(first, "a", [rename("hero", "Big heading")]);
    await first.next("changesAccepted", (message) => message.batch === batch);
    const heard = await second.next("designChanged");
    expect(heard.changes).toEqual([rename("hero", "Big heading")]);

    const reply = send(second, "b", [rename("cta", "Main button")]);
    await second.next("changesAccepted", (message) => message.batch === reply);
    await first.next("designChanged");

    await store(first, "a");
    const { document } = (await inDesign("owner", "c")).opened;
    expect(findNode(document.root, "hero")?.name).toBe("Big heading");
    expect(findNode(document.root, "cta")?.name).toBe("Main button");
  });

  it("stores the design into the entry, and keeps the rest of the entry", async () => {
    const { browser } = await inDesign("owner", "a");
    await owner("PATCH", `/entries/${entryId}`, { data: { title: "New title" } });
    send(browser, "a", [rename("hero", "Stored")]);
    await browser.next("changesAccepted");
    await store(browser, "a");
    const entry = await stored();
    expect(entry.data.title).toBe("New title");
    expect(findNode((entry.data.design as PageDocument).root, "hero")?.name).toBe("Stored");
  });

  it("merges two people's words in the same sentence", async () => {
    const { browser: first } = await inDesign("owner", "a");
    const { browser: second } = await inDesign("editor", "b");
    send(first, "a", [
      {
        op: "text",
        node: "hero",
        prop: "text",
        from: "Fresh bread daily",
        to: "Fresh rye bread daily",
      },
    ]);
    send(second, "b", [
      {
        op: "text",
        node: "hero",
        prop: "text",
        from: "Fresh bread daily",
        to: "Fresh bread every day",
      },
    ]);
    await first.next("changesAccepted");
    await second.next("changesAccepted");
    await store(first, "a");
    const hero = findNode((await stored()).data.design?.root as PageDocument["root"], "hero");
    expect(hero?.props.text).toBe("Fresh rye bread every day");
  });

  it("lets a client change the words they may change", async () => {
    const { browser, opened } = await inDesign("client", "a");
    expect(opened.canEdit).toBe(true);
    const batch = send(browser, "a", [
      { op: "set", node: "hero", path: ["props", "text"], value: "Sourdough" },
    ]);
    await browser.next("changesAccepted", (message) => message.batch === batch);
  });

  it("refuses a client changing the design, and nobody else sees it", async () => {
    const { browser: designer } = await inDesign("owner", "d");
    const { browser: client } = await inDesign("client", "a");
    const batch = send(client, "a", [
      { op: "set", node: "hero", path: ["styles", "base", "color"], value: "#ff0000" },
    ]);
    const refused = await client.next("changesRefused", (message) => message.batch === batch);
    expect(refused.code).toBe("DESIGN_CHANGE_NOT_ALLOWED");
    expect(refused.message).toContain("Heading");
    expect(designer.received("designChanged")).toHaveLength(0);
    await store(designer, "d");
    const hero = findNode((await stored()).data.design?.root as PageDocument["root"], "hero");
    expect(hero?.styles?.base).toEqual({});
  });

  it("refuses a client removing an element", async () => {
    const { browser } = await inDesign("client", "a");
    const batch = send(browser, "a", [{ op: "remove", node: "cta" }]);
    const refused = await browser.next("changesRefused", (each) => each.batch === batch);
    expect(refused.code).toBe("DESIGN_CHANGE_NOT_ALLOWED");
  });

  it("does not hold a designer's changes against a client storing the page", async () => {
    const { browser: designer } = await inDesign("owner", "d");
    const { browser: client } = await inDesign("client", "a");
    send(designer, "d", [
      { op: "set", node: "hero", path: ["styles", "base", "color"], value: "#ff0000" },
    ]);
    await designer.next("changesAccepted");
    const batch = send(client, "a", [
      { op: "set", node: "cta", path: ["props", "label"], value: "Buy" },
    ]);
    await client.next("changesAccepted", (message) => message.batch === batch);
    await store(client, "a");
    const root = (await stored()).data.design?.root as PageDocument["root"];
    expect(findNode(root, "hero")?.styles?.base?.color).toBe("#ff0000");
    expect(findNode(root, "cta")?.props.label).toBe("Buy");
  });

  it("lets a viewer watch, and refuses them changing anything", async () => {
    const { browser, opened } = await inDesign("viewer", "a");
    expect(opened.canEdit).toBe(false);
    const batch = send(browser, "a", [rename("hero", "Mine now")]);
    const refused = await browser.next("changesRefused", (message) => message.batch === batch);
    expect(refused.code).toBe("NOT_ALLOWED");
  });

  it("refuses code from someone who may not add it", async () => {
    await createPersonWithRole(database.database, "author@example.com", "author", "Ann Author");
    cookies.editor = await signInAndGetCookies(server, "author@example.com");
    await owner("PATCH", `/entries/${entryId}`, {});
    const created = await requestsAs(server, cookies.editor)("POST", "/collections/pages/entries", {
      data: { title: "Mine", design: startingPage() },
    });
    entryId = created.json<SavedEntry>().id;
    const { browser } = await inDesign("editor", "a");
    const batch = send(browser, "a", [
      {
        op: "insert",
        parent: "page",
        after: null,
        node: {
          id: "sneaky",
          type: "codeBlock",
          name: "",
          props: { html: "<b>hi</b>" },
          styles: { base: {} },
          children: [],
          hidden: false,
          locked: false,
        },
      },
    ]);
    const refused = await browser.next("changesRefused", (message) => message.batch === batch);
    expect(refused.message).toMatch(/code/i);
    await store(browser, "a");
    expect(JSON.stringify((await stored()).data.design)).not.toContain("sneaky");
  });

  it("refuses steps that would leave the page invalid", async () => {
    const { browser } = await inDesign("owner", "a");
    const batch = send(browser, "a", [
      { op: "set", node: "hero", path: ["styles", "base", "color"], value: "url(evil)" },
    ]);
    await browser.next("changesRefused", (message) => message.batch === batch);
  });

  it("will not open a design for someone who has not entered the page", async () => {
    const browser = await connectAs(address, cookies.owner);
    open.push(browser);
    browser.send({ type: "openDesign", tab: "a", entryId, field });
    expect((await browser.next("refused")).code).toBe("NOT_FOUND");
  });

  it("will not take changes from a tab that has not opened the design", async () => {
    const browser = await connectAs(address, cookies.owner);
    open.push(browser);
    browser.send({ type: "enterPage", tab: "a", entryId, view: "design" });
    await browser.next("peopleHere");
    send(browser, "a", [rename("hero", "Sneaking in")]);
    expect((await browser.next("refused")).code).toBe("NOT_FOUND");
  });

  it("only opens page fields", async () => {
    const browser = await connectAs(address, cookies.owner);
    open.push(browser);
    browser.send({ type: "enterPage", tab: "a", entryId, view: "design" });
    browser.send({ type: "openDesign", tab: "a", entryId, field: "title" });
    expect((await browser.next("refused")).code).toBe("NOT_FOUND");
  });

  it("counts a batch sent twice once", async () => {
    const { browser: first } = await inDesign("owner", "a");
    const { browser: second } = await inDesign("editor", "b");
    const message = {
      type: "changes",
      tab: "a",
      entryId,
      field,
      batch: "again",
      changes: [rename("hero", "Once")],
    } as unknown as LiveClientMessage;
    first.send(message);
    await first.next("changesAccepted");
    first.send(message);
    await first.next("changesAccepted");
    await second.next("designChanged");
    expect(second.received("designChanged")).toHaveLength(0);
  });

  it("says everything is stored when a change turned out to change nothing", async () => {
    const { browser } = await inDesign("owner", "a");
    send(browser, "a", [rename("element-someone-removed", "Too late")]);
    await browser.next("changesAccepted");
    await browser.next("designStored");
  });

  it("stores what is open before publishing, so nothing live is out of date", async () => {
    const { browser } = await inDesign("owner", "a");
    send(browser, "a", [rename("hero", "Going live")]);
    await browser.next("changesAccepted");
    await owner("POST", `/entries/${entryId}/publish`);
    const live = await owner("GET", `/entries/${entryId}/live`);
    const design = live.json<{ data: { design: PageDocument } }>().data.design;
    expect(findNode(design.root, "hero")?.name).toBe("Going live");
    expect((await browser.next("entryChanged", (each) => each.what === "published")).version).toBe(
      (await stored()).version,
    );
  });

  it("leaves what is live alone until someone publishes", async () => {
    await owner("POST", `/entries/${entryId}/publish`);
    const { browser } = await inDesign("owner", "a");
    send(browser, "a", [rename("hero", "Not live yet")]);
    await browser.next("changesAccepted");
    expect((await store(browser, "a")).hasUnpublishedChanges).toBe(true);
    const live = await owner("GET", `/entries/${entryId}/live`);
    const design = live.json<{ data: { design: PageDocument } }>().data.design;
    expect(findNode(design.root, "hero")?.name).toBe("");
  });

  it("takes in a save made through the API, on top of what people are doing", async () => {
    const { browser } = await inDesign("owner", "a");
    await store(browser, "a");
    const page = startingPage();
    const children = page.root.children.map((child) =>
      child.id === "cta" ? { ...child, name: "From the API" } : child,
    );
    const saved = await owner("PATCH", `/entries/${entryId}`, {
      data: { design: { ...page, root: { ...page.root, children } } },
    });
    expect(saved.statusCode).toBe(200);
    const heard = await browser.next("designChanged");
    expect(heard.changes).toContainEqual(rename("cta", "From the API"));
  });

  it("checks a save with an old version against what people have done live", async () => {
    const { browser, opened } = await inDesign("owner", "a");
    send(browser, "a", [rename("hero", "Live change")]);
    await browser.next("changesAccepted");
    const saved = await owner("PATCH", `/entries/${entryId}`, {
      data: { design: startingPage() },
      baseVersion: opened.version,
    });
    expect(saved.statusCode).toBe(409);
  });

  it("takes in a restored version", async () => {
    await owner("POST", `/entries/${entryId}/publish`);
    const { browser } = await inDesign("owner", "a");
    send(browser, "a", [rename("hero", "Before restoring")]);
    await browser.next("changesAccepted");
    await store(browser, "a");
    const history = await owner("GET", `/entries/${entryId}/revisions`);
    const { revisions } = history.json<{ revisions: { id: string }[] }>();
    const oldest = revisions.at(-1)?.id ?? "";
    await owner("POST", `/entries/${entryId}/revisions/${oldest}/restore`);
    const heard = await browser.next("designChanged");
    expect(heard.changes).toContainEqual(rename("hero", ""));
  });

  it("takes in a change it hasn't heard about yet, rather than storing over it", async () => {
    const { browser } = await inDesign("owner", "a");
    // Straight into the table, as something that announces nothing would.
    const page = startingPage();
    const children = page.root.children.map((child) =>
      child.id === "cta" ? { ...child, name: "Written behind the room's back" } : child,
    );
    const before = await findEntryById(database.database, entryId);
    await updateEntryRow(database.database, entryId, {
      version: (before?.version ?? 0) + 1,
      data: { ...before?.data, design: { ...page, root: { ...page.root, children } } },
    });
    send(browser, "a", [rename("hero", "Stored on top")]);
    await browser.next("changesAccepted");
    await store(browser, "a");
    const root = (await stored()).data.design?.root as Node;
    expect(findNode(root, "cta")?.name).toBe("Written behind the room's back");
    expect(findNode(root, "hero")?.name).toBe("Stored on top");
    expect((await browser.next("designChanged")).changes).toContainEqual(
      rename("cta", "Written behind the room's back"),
    );
  });

  it("does not store over a version it was not told about", async () => {
    const entry = await stored();
    const result = await storeDesign(database.database, entryId, field, startingPage(), {
      assetExists: async () => true,
      authorId: null,
      expectedVersion: entry.version - 1,
    });
    expect(result).toBe("moved");
  });

  it("says a batch sent twice was already applied, so it isn't applied again", async () => {
    const { browser } = await inDesign("owner", "a");
    const message = {
      type: "changes",
      tab: "a",
      entryId,
      field,
      batch: "twice",
      changes: [rename("hero", "Once")],
    } as unknown as LiveClientMessage;
    browser.send(message);
    await browser.next("changesAccepted", (each) => each.alreadyApplied !== true);
    browser.send(message);
    await browser.next("changesAccepted", (each) => each.alreadyApplied === true);
  });

  it("stores when the last person leaves", async () => {
    const { browser } = await inDesign("owner", "a");
    send(browser, "a", [rename("hero", "Leaving")]);
    await browser.next("changesAccepted");
    browser.close();
    await expect
      .poll(async () => findNode((await stored()).data.design?.root as Node, "hero")?.name)
      .toBe("Leaving");
  });

  it("gives someone coming back the page as it is now, in the same session", async () => {
    const { browser: first, opened } = await inDesign("owner", "a");
    const { browser: second } = await inDesign("editor", "b");
    second.close();
    send(first, "a", [rename("hero", "While you were away")]);
    await first.next("changesAccepted");
    const { opened: back } = await inDesign("editor", "b");
    expect(back.session).toBe(opened.session);
    expect(findNode(back.document.root, "hero")?.name).toBe("While you were away");
  });

  it("shares one line of History between people editing together", async () => {
    const { browser: first } = await inDesign("owner", "a");
    const { browser: second } = await inDesign("editor", "b");
    for (const [browser, tab, name] of [
      [first, "a", "One"],
      [second, "b", "Two"],
      [first, "a", "Three"],
    ] as const) {
      send(browser, tab, [rename("hero", name)]);
      await browser.next("changesAccepted");
      await store(browser, tab);
    }
    const history = await owner("GET", `/entries/${entryId}/revisions`);
    expect(history.json<{ revisions: unknown[] }>().revisions).toHaveLength(1);
  });

  it("stores what is waiting when the server stops", async () => {
    const { browser } = await inDesign("owner", "a");
    send(browser, "a", [rename("hero", "Stopping")]);
    await browser.next("changesAccepted");
    const reader = await startTestServer(database.activeDatabase);
    await server.close();
    const entry = await requestsAs(reader, cookies.owner)("GET", `/entries/${entryId}`);
    const design = entry.json<SavedEntry>().data.design as PageDocument;
    expect(findNode(design.root, "hero")?.name).toBe("Stopping");
    await reader.close();
  });

  it("takes someone off the page and out of the room once they lose access", async () => {
    const { browser } = await inDesign("editor", "a");
    await database.database.execute("delete from user_roles");
    server.collaboration.sweep();
    expect((await browser.next("refused")).code).toBe("NOT_ALLOWED");
    const batch = send(browser, "a", [rename("hero", "Too late")]);
    await browser.next("changesRefused", (message) => message.batch === batch);
  });
});
