import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { SESSION_COOKIE_NAME } from "../auth/session-cookie.js";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { CLIENT_ROLE_HANDLE } from "../roles/built-in-roles.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createPersonWithRole } from "../testing/test-people.js";
import { requestsAs, startTestServer } from "../testing/test-server.js";
import { signInAndGetCookies } from "../testing/test-users.js";
import { liveLimits } from "./live-limits.js";
import { MessageBudget } from "./message-budget.js";
import { connectAs, type TestBrowser } from "../testing/test-live-browser.js";

const adminOrigin = "http://localhost:5173";

describe("the live connection", () => {
  const database = useTestDatabase();
  let server: FastifyInstance;
  let address: string;
  let owner: Record<string, string>;
  let client: Record<string, string>;
  let entryId: string;
  let siteId: string;
  const open: TestBrowser[] = [];

  const browser = async (cookies: Record<string, string>) => {
    const connected = await connectAs(address, cookies);
    open.push(connected);
    return connected;
  };

  beforeEach(async () => {
    server = await startTestServer(database.activeDatabase);
    await server.listen({ port: 0, host: "127.0.0.1" });
    address = `ws://127.0.0.1:${(server.server.address() as AddressInfo).port}`;
    const db = database.database;
    await ensurePagesCollection(db);
    await createPersonWithRole(db, "owner@example.com", "owner", "Olive Owner");
    await createPersonWithRole(db, "client@example.com", CLIENT_ROLE_HANDLE, "Clara Client");
    owner = await signInAndGetCookies(server, "owner@example.com");
    client = await signInAndGetCookies(server, "client@example.com");
    const created = await requestsAs(server, owner)("POST", "/collections/pages/entries", {
      data: { title: "Home" },
    });
    entryId = created.json<{ id: string }>().id;
    const sites = await requestsAs(server, owner)("GET", "/sites");
    siteId = sites.json<{ sites: { id: string }[] }>().sites[0]?.id ?? "";
  });

  afterEach(async () => {
    for (const each of open.splice(0)) each.close();
    await server.close();
  });

  const refusedUpgrade = (headers: Record<string, string>) =>
    new Promise<number>((resolve, reject) => {
      const socket = new WebSocket(`${address}/live`, { headers });
      socket.on("unexpected-response", (_request, response) => resolve(response.statusCode ?? 0));
      socket.on("open", () => reject(new Error("The connection opened")));
      socket.on("error", () => undefined);
    });

  const cookieHeader = (cookies: Record<string, string>) =>
    `${SESSION_COOKIE_NAME}=${cookies[SESSION_COOKIE_NAME] ?? ""}`;

  it("refuses anyone who is not signed in", async () => {
    expect(await refusedUpgrade({ origin: adminOrigin })).toBe(401);
  });

  it("refuses another website, even with a session cookie", async () => {
    const cookie = cookieHeader(owner);
    expect(await refusedUpgrade({ cookie, origin: "https://evil.example" })).toBe(403);
  });

  it("refuses a request that says nothing about where it came from", async () => {
    expect(await refusedUpgrade({ cookie: cookieHeader(owner) })).toBe(403);
  });

  it("tells each person who else is on the page, and when they leave", async () => {
    const first = await browser(owner);
    const second = await browser(client);
    first.send({ type: "enterPage", tab: "a", entryId, view: "design" });
    await first.next("peopleHere", (message) => message.people.length === 1);
    second.send({ type: "enterPage", tab: "b", entryId, view: "content" });
    const here = await first.next("peopleHere", (message) => message.people.length === 2);
    expect(here.people.map((person) => [person.name, person.view]).sort()).toEqual([
      ["Clara Client", "content"],
      ["Olive Owner", "design"],
    ]);
    expect(JSON.stringify(here)).not.toContain("@example.com");
    second.close();
    await first.next("peopleHere", (message) => message.people.length === 1);
  });

  it("shows the content tree who is on which page", async () => {
    const watcher = await browser(client);
    watcher.send({ type: "watchSite", tab: "tree", siteId });
    await watcher.next("peopleOnPages", (message) => Object.keys(message.pages).length === 0);
    const editor = await browser(owner);
    editor.send({ type: "enterPage", tab: "a", entryId, view: "content" });
    const pages = await watcher.next("peopleOnPages", (message) => entryId in message.pages);
    expect(pages.pages[entryId]?.[0]?.name).toBe("Olive Owner");
  });

  it("counts one person once, however many tabs share the connection", async () => {
    const first = await browser(owner);
    first.send({ type: "enterPage", tab: "a", entryId, view: "content" });
    first.send({ type: "enterPage", tab: "b", entryId, view: "design" });
    const here = await first.next(
      "peopleHere",
      (message) => message.tab === "b" && message.people[0]?.view === "design",
    );
    expect(here.people).toHaveLength(1);
    expect(server.collaboration.connectionCount()).toBe(1);
  });

  it("passes on what someone is doing, to the others on that page", async () => {
    const first = await browser(owner);
    const second = await browser(client);
    first.send({ type: "enterPage", tab: "a", entryId, view: "design" });
    second.send({ type: "enterPage", tab: "b", entryId, view: "design" });
    await second.next("peopleHere", (message) => message.people.length === 2);
    const activity = { pointer: { nodeId: "h1", x: 0.5, y: 0.5 }, selection: ["h1"], field: null };
    first.send({ type: "activity", tab: "a", entryId, activity });
    expect((await second.next("activity")).activity).toEqual(activity);
  });

  it("does not let someone send activity to a page they are not on", async () => {
    const first = await browser(owner);
    const second = await browser(client);
    second.send({ type: "enterPage", tab: "b", entryId, view: "design" });
    await second.next("peopleHere");
    first.send({
      type: "activity",
      tab: "a",
      entryId,
      activity: { pointer: null, selection: [], field: null },
    });
    first.send({ type: "ping", tab: "a" });
    await first.next("pong");
    expect(second.received("activity")).toHaveLength(0);
  });

  it("says a page does not exist, whether it is missing or out of reach", async () => {
    const first = await browser(client);
    first.send({
      type: "enterPage",
      tab: "a",
      entryId: "00000000-0000-4000-8000-000000000000",
      view: "content",
    });
    expect((await first.next("refused")).code).toBe("NOT_FOUND");
  });

  it("keeps people apart by tenant", async () => {
    const stranger = await browser(owner);
    await database.database.execute(
      `update entries set tenant_id = 'another-agency' where id = '${entryId}'`,
    );
    stranger.send({ type: "enterPage", tab: "a", entryId, view: "content" });
    expect((await stranger.next("refused")).code).toBe("NOT_FOUND");
  });

  it("won't show the tree of another tenant's site", async () => {
    await database.database.execute(
      `update sites set tenant_id = 'another-agency' where id = '${siteId}'`,
    );
    const stranger = await browser(owner);
    stranger.send({ type: "watchSite", tab: "tree", siteId });
    expect((await stranger.next("refused")).code).toBe("NOT_ALLOWED");
  });

  it("closes the connection once the person has signed out", async () => {
    const first = await browser(owner);
    await requestsAs(server, owner)("POST", "/auth/sign-out");
    server.collaboration.sweep();
    expect(await first.closed()).toBe(4401);
  });

  it("refuses messages it cannot read, and closes on a stream of them", async () => {
    const first = await browser(owner);
    first.sendRaw("this is not JSON");
    expect((await first.next("refused")).code).toBe("BAD_MESSAGE");
    for (let count = 0; count < liveLimits.strikesBeforeClosing; count += 1) {
      first.sendRaw(JSON.stringify({ type: "unknown", tab: "a" }));
    }
    expect(await first.closed()).toBe(4408);
  });

  it("closes a connection sending more than a message may hold", async () => {
    const first = await browser(owner);
    first.sendRaw("x".repeat(liveLimits.maxMessageBytes + 1));
    expect([1006, 1009]).toContain(await first.closed());
  });

  it("limits how many connections one person can open", async () => {
    for (let count = 0; count < liveLimits.maxConnectionsPerPerson; count += 1) {
      await browser(owner);
    }
    const extra = await browser(owner);
    expect(await extra.closed()).toBe(4429);
  });
});

describe("a connection's budget", () => {
  it("allows a burst, then only what refills", () => {
    const budget = new MessageBudget(0);
    for (let count = 0; count < liveLimits.messageBurst; count += 1) {
      expect(budget.spend(10, 0)).toBe(true);
    }
    expect(budget.spend(10, 0)).toBe(false);
    expect(budget.spend(10, 1000)).toBe(true);
  });

  it("counts bytes as well as messages", () => {
    const budget = new MessageBudget(0);
    expect(budget.spend(liveLimits.byteBurst, 0)).toBe(true);
    expect(budget.spend(10, 0)).toBe(false);
  });
});
