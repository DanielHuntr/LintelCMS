import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { LocalDiskStorage } from "../media/local-disk-storage.js";
import { multipartFile } from "../testing/multipart.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createHomePage } from "../testing/test-home-page.js";
import { makeTestPng } from "../testing/test-media.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { verifyWebhookSignature } from "./webhook-signatures.js";

interface ReceivedRequest {
  headers: IncomingHttpHeaders;
  body: string;
}

/** A website that receives webhooks on this machine, answering with `status`. */
async function startReceiver() {
  const receiver = {
    received: [] as ReceivedRequest[],
    status: 200,
    url: "",
    server: undefined as Server | undefined,
  };
  receiver.server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => (body += chunk.toString()));
    request.on("end", () => {
      receiver.received.push({ headers: request.headers, body });
      response.writeHead(receiver.status).end(receiver.status === 200 ? "thanks" : "broken");
    });
  });
  await new Promise<void>((resolve) => receiver.server?.listen(0, "127.0.0.1", resolve));
  const { port } = receiver.server.address() as AddressInfo;
  receiver.url = `http://127.0.0.1:${port}/hooks/lintel`;
  return receiver;
}

describe("webhooks", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;
  let receiver: Awaited<ReturnType<typeof startReceiver>>;
  let mediaFolder: string;

  beforeEach(async () => {
    receiver = await startReceiver();
    mediaFolder = await mkdtemp(join(tmpdir(), "lintel-webhooks-"));
    server = await startTestServer(testDatabase.activeDatabase, {
      webhooks: { allowPrivateAddresses: true, sendStraightAway: false },
      media: {
        storage: new LocalDiskStorage(join(mediaFolder, "uploads")),
        transformCacheFolder: join(mediaFolder, "cache"),
      },
    });
    await ensurePagesCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "admin@example.com"));
  });

  afterEach(async () => {
    await server.close();
    await new Promise((resolve) => receiver.server?.close(resolve));
    await rm(mediaFolder, { recursive: true, force: true });
  });

  async function addWebhook(events: string[]) {
    const response = await api("POST", "/webhooks", { url: receiver.url, events });
    expect(response.statusCode).toBe(201);
    return response.json();
  }

  async function publishPage(title: string) {
    const created = await api("POST", "/collections/pages/entries", { data: { title } });
    await api("POST", `/entries/${created.json().id}/publish`);
    return created.json().id as string;
  }

  it("sends a signed request when an entry is published, and logs it", async () => {
    await createHomePage(api);
    const webhook = await addWebhook(["entry.published"]);
    expect(webhook).toMatchObject({
      name: "127.0.0.1:" + new URL(receiver.url).port,
      events: ["entry.published"],
      enabled: true,
      secret: expect.stringMatching(/^whsec_/),
    });

    const entryId = await publishPage("Opening hours");
    await server.webhooks.deliverDue();

    expect(receiver.received).toHaveLength(1);
    const [request] = receiver.received;
    expect(request?.headers["lintel-event"]).toBe("entry.published");
    expect(
      verifyWebhookSignature(
        webhook.secret,
        request?.body ?? "",
        String(request?.headers["lintel-signature"]),
      ),
    ).toBe(true);
    expect(JSON.parse(request?.body ?? "")).toMatchObject({
      event: "entry.published",
      data: {
        entry: { id: entryId, collection: "pages", slug: "opening-hours", url: "/opening-hours" },
      },
    });

    const log = await api("GET", `/webhooks/${webhook.id}/deliveries`);
    expect(log.json()).toMatchObject({
      total: 1,
      deliveries: [
        { status: "delivered", attemptCount: 1, responseStatus: 200, responseSummary: "thanks" },
      ],
    });
    expect((await api("GET", `/webhooks/${webhook.id}`)).json().lastDelivery.status).toBe(
      "delivered",
    );
  });

  it("only sends the events a webhook asked for, and nothing while it is switched off", async () => {
    const webhook = await addWebhook(["entry.deleted"]);
    const entryId = await publishPage("Temporary");
    await api("POST", `/entries/${entryId}/unpublish`);
    await server.webhooks.deliverDue();
    expect(receiver.received).toHaveLength(0);

    await api("PATCH", `/webhooks/${webhook.id}`, { enabled: false });
    await api("DELETE", `/entries/${entryId}`);
    await server.webhooks.deliverDue();
    expect(receiver.received).toHaveLength(0);

    await api("PATCH", `/webhooks/${webhook.id}`, { enabled: true });
    const second = await publishPage("Another");
    await api("DELETE", `/entries/${second}`);
    await server.webhooks.deliverDue();
    expect(receiver.received.map((request) => request.headers["lintel-event"])).toEqual([
      "entry.deleted",
    ]);
    expect(JSON.parse(receiver.received[0]?.body ?? "").data.entry.title).toBe("Another");
  });

  it("tells webhooks about uploads and deleted files", async () => {
    await addWebhook(["asset.uploaded", "asset.deleted"]);
    const upload = await server.inject({
      method: "POST",
      url: "/media",
      cookies: await signInAndGetCookies(server, "admin@example.com"),
      ...multipartFile("logo.png", await makeTestPng(8, 8)),
    });
    await api("DELETE", `/media/${upload.json().id}`);
    await server.webhooks.deliverDue();

    expect(receiver.received.map((request) => request.headers["lintel-event"]).sort()).toEqual([
      "asset.deleted",
      "asset.uploaded",
    ]);
    expect(JSON.parse(receiver.received[0]?.body ?? "").data.asset).toMatchObject({
      filename: "logo.png",
      mimeType: "image/png",
    });
  });

  it("retries a failed delivery with growing gaps, then gives up", async () => {
    const webhook = await addWebhook(["entry.published"]);
    receiver.status = 500;
    await publishPage("Flaky");

    const start = new Date();
    await server.webhooks.deliverDue(start);
    let [delivery] = (await api("GET", `/webhooks/${webhook.id}/deliveries`)).json().deliveries;
    expect(delivery).toMatchObject({ status: "pending", attemptCount: 1, responseStatus: 500 });
    expect(new Date(delivery.nextAttemptAt).getTime() - start.getTime()).toBe(60_000);

    // Not due yet: nothing is sent.
    await server.webhooks.deliverDue(new Date(start.getTime() + 30_000));
    expect(receiver.received).toHaveLength(1);

    let now = start;
    for (const minutes of [1, 5, 30, 120, 720]) {
      now = new Date(now.getTime() + minutes * 60_000);
      await server.webhooks.deliverDue(now);
    }
    [delivery] = (await api("GET", `/webhooks/${webhook.id}/deliveries`)).json().deliveries;
    expect(receiver.received).toHaveLength(6);
    expect(delivery).toMatchObject({ status: "failed", attemptCount: 6, nextAttemptAt: null });
  });

  it("resends a delivery as a new one with the same data", async () => {
    const webhook = await addWebhook(["entry.published"]);
    await publishPage("Again");
    await server.webhooks.deliverDue();
    const [original] = (await api("GET", `/webhooks/${webhook.id}/deliveries`)).json().deliveries;

    const resent = await api("POST", `/webhooks/${webhook.id}/deliveries/${original.id}/resend`);
    await server.webhooks.deliverDue();

    expect(resent.statusCode).toBe(202);
    expect(resent.json()).toMatchObject({ status: "pending", event: "entry.published" });
    expect(resent.json().id).not.toBe(original.id);
    expect(receiver.received).toHaveLength(2);
    const bodies = receiver.received.map((request) => JSON.parse(request.body));
    expect(bodies[1].data).toEqual(bodies[0].data);
    expect(bodies[1].id).toBe(resent.json().id);
  });

  it("checks addresses and events, and needs settings permissions", async () => {
    const wrongEvent = await api("POST", "/webhooks", { url: receiver.url, events: ["party"] });
    const noEvents = await api("POST", "/webhooks", { url: receiver.url, events: [] });
    const notAUrl = await api("POST", "/webhooks", {
      url: "ftp://example.com",
      events: ["entry.published"],
    });
    expect(wrongEvent.statusCode).toBe(400);
    expect(noEvents.json().message).toContain("Choose at least one event");
    expect(notAUrl.json().message).toContain("should start with https://");

    await createTestUser(testDatabase.database, "editor@example.com", [["entries:*"]]);
    const editor = requestsAs(server, await signInAndGetCookies(server, "editor@example.com"));
    expect((await editor("GET", "/webhooks")).statusCode).toBe(403);
  });
});

describe("webhooks on a real server", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "admin@example.com"));
  });

  afterEach(() => server.close());

  it("refuses private and local addresses", async () => {
    for (const url of [
      "http://localhost:3000/hook",
      "http://127.0.0.1/hook",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/hook",
      "http://10.0.0.8/hook",
    ]) {
      const response = await api("POST", "/webhooks", { url, events: ["entry.published"] });
      expect(response.statusCode, url).toBe(400);
      expect(response.json().code).toBe("PRIVATE_WEBHOOK_ADDRESS");
    }
  });
});
