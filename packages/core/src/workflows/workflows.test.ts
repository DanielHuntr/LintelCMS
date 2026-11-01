import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { setEnabledPlugins } from "../plugins/plugins.service.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { verifyWebhookSignature } from "../webhooks/webhook-signatures.js";
import { startRunsForEvent, startScheduledRuns } from "./engine/workflow-triggers.js";

interface ReceivedRequest {
  method: string;
  headers: IncomingHttpHeaders;
  body: string;
}

/** Someone's own server, in any language, that Lintel calls. Answers with `statuses` in turn. */
async function startReceiver() {
  const receiver = {
    received: [] as ReceivedRequest[],
    statuses: [200],
    url: "",
    server: undefined as Server | undefined,
  };
  receiver.server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => (body += chunk.toString()));
    request.on("end", () => {
      receiver.received.push({ method: request.method ?? "", headers: request.headers, body });
      const status = receiver.statuses.shift() ?? 200;
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: status === 200, ticket: "T-42" }));
    });
  });
  await new Promise<void>((resolve) => receiver.server?.listen(0, "127.0.0.1", resolve));
  const { port } = receiver.server.address() as AddressInfo;
  receiver.url = `http://127.0.0.1:${port}/lintel`;
  return receiver;
}

describe("workflows", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;
  let receiver: Awaited<ReturnType<typeof startReceiver>>;

  beforeEach(async () => {
    receiver = await startReceiver();
    server = await startTestServer(testDatabase.activeDatabase, {
      webhooks: { allowPrivateAddresses: true, sendStraightAway: false },
    });
    await ensurePagesCollection(testDatabase.database);
    await setEnabledPlugins(testDatabase.database, server.plugins, ["automations"]);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "admin@example.com"));
  });

  afterEach(async () => {
    await server.close();
    await new Promise((resolve) => receiver.server?.close(resolve));
  });

  async function addWorkflow(definition: Record<string, unknown>) {
    const response = await api("POST", "/workflows", { name: "Test workflow", ...definition });
    expect(response.statusCode, response.body).toBe(201);
    return response.json<{ id: string; secret: string }>();
  }

  async function publishPage(title: string, data: Record<string, unknown> = {}) {
    const created = await api("POST", "/collections/pages/entries", { data: { title, ...data } });
    await api("POST", `/entries/${created.json().id}/publish`);
    return created.json<{ id: string }>();
  }

  async function latestRun(workflowId: string) {
    const { runs } = (await api("GET", `/workflows/${workflowId}/runs`)).json<{
      runs: { id: string }[];
    }>();
    const run = await api("GET", `/workflow-runs/${runs[0]?.id}`);
    return run.json<{
      status: string;
      error: string | null;
      nextRunAt: string | null;
      logs: { stepId: string; status: string; summary: string }[];
    }>();
  }

  it("calls your server when content is published, signed, with a templated JSON body", async () => {
    const workflow = await addWorkflow({
      trigger: { type: "event", event: "entry.published", collections: ["pages"] },
      steps: [
        {
          id: "callServer",
          type: "http_request",
          url: `${receiver.url}/{{entry.slug}}`,
          method: "POST",
          headers: [{ name: "X-Site", value: "{{entry.collection}}" }],
          body: '{"title": "{{entry.title}}", "entry": "{{entry}}", "by": "{{actor.email}}"}',
        },
        {
          id: "mail",
          type: "send_email",
          to: { type: "addresses", addresses: "team@example.com" },
          subject: "Published: {{entry.title}}",
          body: "Ticket {{steps.callServer.body.ticket}}",
        },
      ],
    });

    await publishPage('About "us"');
    await server.workflows.runDue();

    expect(receiver.received).toHaveLength(1);
    const [request] = receiver.received;
    expect(request?.headers["x-site"]).toBe("pages");
    expect(request?.headers["idempotency-key"]).toMatch(/:callServer$/);
    const body = JSON.parse(request?.body ?? "{}");
    expect(body).toMatchObject({ title: 'About "us"', by: "admin@example.com" });
    expect(body.entry).toMatchObject({ collection: "pages", fields: { title: 'About "us"' } });
    expect(
      verifyWebhookSignature(
        workflow.secret,
        request?.body ?? "",
        String(request?.headers["lintel-signature"]),
      ),
    ).toBe(true);
    expect(
      server.emailOutbox!.list().map(({ to, subject, text }) => ({ to, subject, text })),
    ).toEqual([{ to: "team@example.com", subject: 'Published: About "us"', text: "Ticket T-42" }]);
    const run = await latestRun(workflow.id);
    expect(run.status).toBe("succeeded");
    expect(run.logs.map((log) => [log.stepId, log.status])).toEqual([
      ["callServer", "succeeded"],
      ["mail", "succeeded"],
    ]);
  });

  it("starts each workflow once per event, however often the event is heard", async () => {
    const workflow = await addWorkflow({
      trigger: { type: "event", event: "asset.uploaded", collections: [] },
      steps: [],
    });
    const event = await server.events.publish("asset.uploaded", {
      asset: { id: "a", filename: "a.png", mimeType: "image/png", url: "/a.png" },
    });

    expect(await startRunsForEvent(testDatabase.database, event)).toBe(0);
    const { total } = (await api("GET", `/workflows/${workflow.id}/runs`)).json<{
      total: number;
    }>();
    expect(total).toBe(1);
  });

  it("follows conditions down one branch", async () => {
    const workflow = await addWorkflow({
      trigger: { type: "event", event: "entry.published", collections: [] },
      steps: [
        {
          id: "isNews",
          type: "condition",
          match: "all",
          conditions: [{ type: "field_contains", field: "title", value: "news" }],
          then: [
            {
              id: "tellTeam",
              type: "notify_users",
              to: { type: "actor" },
              message: "News went out: {{entry.title}}",
            },
          ],
          otherwise: [],
        },
      ],
    });

    await publishPage("Company News");
    await publishPage("About");
    await server.workflows.runDue();

    const notifications = (await api("GET", "/notifications")).json<{
      unread: number;
      notifications: { message: string; link: string }[];
    }>();
    expect(notifications.unread).toBe(1);
    expect(notifications.notifications[0]?.message).toBe("News went out: Company News");
    expect(notifications.notifications[0]?.link).toMatch(/^\/content\/pages\//);
    const run = await latestRun(workflow.id);
    expect(run.logs).toEqual([
      expect.objectContaining({ stepId: "isNews", summary: "title contains “news”: no" }),
    ]);
  });

  it("tries a failing call again later, then carries on", async () => {
    receiver.statuses = [503, 200];
    const workflow = await addWorkflow({
      trigger: { type: "manual" },
      steps: [{ id: "callServer", type: "http_request", url: receiver.url, body: "" }],
    });

    await api("POST", `/workflows/${workflow.id}/run`, {});
    await server.workflows.runDue();
    let run = await latestRun(workflow.id);
    expect(run.status).toBe("waiting");
    expect(run.logs.at(-1)?.status).toBe("retrying");

    await server.workflows.runDue(new Date(Date.now() + 60_000));
    run = await latestRun(workflow.id);
    expect(run.status).toBe("succeeded");
    // The same idempotency key both times, so the receiver can tell it's a retry.
    const [first, second] = receiver.received;
    expect(first?.headers["idempotency-key"]).toBe(second?.headers["idempotency-key"]);
  });

  it("refuses to call private addresses unless allowed", async () => {
    await server.close();
    server = await startTestServer(testDatabase.activeDatabase);
    api = requestsAs(server, await signInAndGetCookies(server, "admin@example.com"));
    const workflow = await addWorkflow({
      trigger: { type: "manual" },
      steps: [
        { id: "probe", type: "http_request", url: "http://169.254.169.254/latest", body: "" },
      ],
    });

    await api("POST", `/workflows/${workflow.id}/run`, {});
    await server.workflows.runDue();

    const run = await latestRun(workflow.id);
    expect(run.status).toBe("failed");
    expect(run.error).toMatch(/private or local address/);
  });

  it("waits, and test runs skip waits and change nothing", async () => {
    const page = await publishPage("About");
    const workflow = await addWorkflow({
      trigger: { type: "event", event: "entry.unpublished", collections: [] },
      steps: [
        { id: "pause", type: "wait", amount: 2, unit: "hours" },
        { id: "republish", type: "publish_entry" },
      ],
    });

    const test = await api("POST", `/workflows/${workflow.id}/run`, { test: true });
    expect(test.statusCode).toBe(202);
    await server.workflows.runDue();
    const testRun = (await api("GET", `/workflow-runs/${test.json().id}`)).json();
    expect(testRun.status).toBe("succeeded");
    expect(testRun.logs.map((log: { status: string }) => log.status)).toEqual([
      "skipped",
      "succeeded",
    ]);
    expect(testRun.logs[1].summary).toMatch(/test run/);

    await api("POST", `/entries/${page.id}/unpublish`);
    await server.workflows.runDue();
    expect((await latestRun(workflow.id)).status).toBe("waiting");

    await server.workflows.runDue(new Date(Date.now() + 3 * 3_600_000));
    expect((await latestRun(workflow.id)).status).toBe("succeeded");
    expect((await api("GET", `/entries/${page.id}`)).json().status).toBe("published");
  });

  it("can change an entry, and can't set itself off forever", async () => {
    const workflow = await addWorkflow({
      trigger: { type: "event", event: "entry.updated", collections: ["pages"] },
      steps: [
        { id: "stamp", type: "update_entry_field", field: "title", value: "{{entry.title}}!" },
      ],
    });
    const created = await api("POST", "/collections/pages/entries", { data: { title: "Hi" } });
    await api("PATCH", `/entries/${created.json().id}`, { data: { title: "Hello" } });

    await server.workflows.runDue();
    await server.workflows.runDue();

    const { total } = (await api("GET", `/workflows/${workflow.id}/runs`)).json();
    expect(total).toBeLessThanOrEqual(6);
    expect((await api("GET", `/entries/${created.json().id}`)).json().data.title).toMatch(
      /^Hello!+$/,
    );
  });

  it("runs on a schedule once per matching minute", async () => {
    const workflow = await addWorkflow({
      trigger: { type: "schedule", cron: "* * * * *" },
      steps: [],
    });
    const now = new Date(Date.now() + 120_000);

    expect(await startScheduledRuns(testDatabase.database, now)).toBe(2);
    expect(await startScheduledRuns(testDatabase.database, now)).toBe(0);
    const { total } = (await api("GET", `/workflows/${workflow.id}/runs`)).json();
    expect(total).toBe(2);
  });

  it("does nothing while the Automations plugin is off, and its routes aren't there", async () => {
    const workflow = await addWorkflow({
      trigger: { type: "event", event: "entry.published", collections: [] },
      steps: [],
    });
    await setEnabledPlugins(testDatabase.database, server.plugins, []);
    await publishPage("About");
    expect((await api("GET", "/workflows")).json().code).toBe("PLUGIN_NOT_ENABLED");

    await setEnabledPlugins(testDatabase.database, server.plugins, ["automations"]);
    const { total } = (await api("GET", `/workflows/${workflow.id}/runs`)).json();
    expect(total).toBe(0);
  });

  it("checks workflows when they are saved, and stops runs on request", async () => {
    const duplicate = await api("POST", "/workflows", {
      name: "Broken",
      trigger: { type: "manual" },
      steps: [
        { id: "same", type: "publish_entry" },
        { id: "same", type: "unpublish_entry" },
      ],
    });
    expect(duplicate.statusCode).toBe(400);
    expect(duplicate.json().message).toMatch(/used twice: same/);

    const badBody = await api("POST", "/workflows", {
      name: "Broken",
      trigger: { type: "manual" },
      steps: [{ id: "call", type: "http_request", url: receiver.url, body: "{not json" }],
    });
    expect(badBody.json().message).toMatch(/isn't valid JSON/);

    const badSchedule = await api("POST", "/workflows", {
      name: "Broken",
      trigger: { type: "schedule", cron: "sometimes" },
      steps: [],
    });
    expect(badSchedule.statusCode).toBe(400);

    const workflow = await addWorkflow({
      trigger: { type: "manual" },
      steps: [{ id: "pause", type: "wait", amount: 1, unit: "days" }],
    });
    const started = (await api("POST", `/workflows/${workflow.id}/run`, {})).json();
    await server.workflows.runDue();
    const cancelled = await api("POST", `/workflow-runs/${started.id}/cancel`);
    expect(cancelled.json().status).toBe("cancelled");
    await server.workflows.runDue(new Date(Date.now() + 2 * 86_400_000));
    expect((await api("GET", `/workflow-runs/${started.id}`)).json().status).toBe("cancelled");
  });

  it("keeps workflows to people who may manage them", async () => {
    await createTestUser(testDatabase.database, "editor@example.com", [["entries:*"]]);
    const editor = requestsAs(server, await signInAndGetCookies(server, "editor@example.com"));
    expect((await editor("GET", "/workflows")).statusCode).toBe(403);
    const catalogue = (await api("GET", "/workflows/catalogue")).json();
    expect(catalogue.events.map((event: { name: string }) => event.name)).toContain(
      "entry.review_requested",
    );
  });
});
