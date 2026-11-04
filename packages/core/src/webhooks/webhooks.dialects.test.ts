import { expect, it } from "vitest";
import type { Database } from "../database/client.js";
import { insertApp } from "../apps/apps.repository.js";
import { addTestUser, describeOnEveryDatabase } from "../testing/every-database.js";
import { updateUserRow } from "../users/users.repository.js";
import {
  claimDueDelivery,
  findDeliveryRow,
  findDueDeliveryIds,
  insertWebhookDeliveries,
  listDeliveryRows,
  recordDeliveryAttempt,
} from "./webhook-deliveries.repository.js";
import {
  deleteWebhookRow,
  findWebhookRow,
  insertWebhook,
  listWebhookRows,
  listWebhooksForEvent,
  updateWebhookRow,
} from "./webhooks.repository.js";

const TENANT = "default";

function addWebhook(database: Database, name = "Build") {
  return insertWebhook(database, {
    name,
    url: "https://example.com/hook",
    events: ["entry.published"],
    secret: "secret",
  });
}

describeOnEveryDatabase("Webhooks", (handle) => {
  it("finds the webhooks that asked for an event, if switched on", async () => {
    const { database } = handle;
    const webhook = await addWebhook(database);
    const asked = await listWebhooksForEvent(database, TENANT, "entry.published");
    expect(asked.map((row) => row.id)).toEqual([webhook.id]);
    expect(await listWebhooksForEvent(database, TENANT, "entry.deleted")).toEqual([]);

    await updateWebhookRow(database, TENANT, webhook.id, { enabled: false });
    expect(await listWebhooksForEvent(database, TENANT, "entry.published")).toEqual([]);
  });

  it("stops telling an app things once its installer is deactivated", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const app = await insertApp(database, {
      handle: "stock-sync",
      name: "Stock sync",
      manifest: {} as never,
      scopes: [],
      clientId: "client",
      clientSecret: "secret",
      clientSecretHash: "hash",
      clientSecretStart: "sec",
      installedBy: user.id,
    });
    await insertWebhook(database, {
      name: "App",
      url: "https://example.com/hook",
      events: ["entry.published"],
      secret: "secret",
      appId: app.id,
    });
    expect(await listWebhooksForEvent(database, TENANT, "entry.published")).toHaveLength(1);
    await updateUserRow(database, user.id, { status: "deactivated" });
    expect(await listWebhooksForEvent(database, TENANT, "entry.published")).toEqual([]);
  });

  it("shows each webhook's newest delivery", async () => {
    const { database } = handle;
    const first = await addWebhook(database, "First");
    const second = await addWebhook(database, "Second");
    await addWebhook(database, "Third");
    const delivery = (webhookId: string, status: "pending" | "failed", minute: number) => ({
      webhookId,
      event: "entry.published" as const,
      payload: {},
      status,
      createdAt: new Date(Date.UTC(2026, 10, 4, 10, minute)),
    });
    await insertWebhookDeliveries(database, [
      delivery(first.id, "failed", 1),
      delivery(first.id, "pending", 2),
      delivery(second.id, "failed", 3),
    ]);

    const rows = await listWebhookRows(database, TENANT);
    expect(rows.map((row) => row.lastDelivery?.status ?? null)).toEqual([
      "pending",
      "failed",
      null,
    ]);
    const found = await findWebhookRow(database, TENANT, first.id);
    expect(found?.lastDelivery?.createdAt).toEqual(new Date(Date.UTC(2026, 10, 4, 10, 2)));
  });

  it("deletes a webhook once", async () => {
    const { database } = handle;
    const webhook = await addWebhook(database);
    expect(await deleteWebhookRow(database, TENANT, webhook.id)).toBe(true);
    expect(await deleteWebhookRow(database, TENANT, webhook.id)).toBe(false);
  });
});

describeOnEveryDatabase("Webhook deliveries", (handle) => {
  const now = new Date("2026-11-04T10:00:00.000Z");
  const leaseUntil = new Date("2026-11-04T10:05:00.000Z");

  async function addDelivery(database: Database) {
    const webhook = await addWebhook(database);
    const [delivery] = await insertWebhookDeliveries(database, [
      {
        webhookId: webhook.id,
        event: "entry.published",
        payload: { id: "a" },
        nextAttemptAt: now,
      },
    ]);
    if (!delivery) throw new Error("The delivery was not saved.");
    return { webhook, delivery };
  }

  it("saves deliveries and pages through them", async () => {
    const { database } = handle;
    expect(await insertWebhookDeliveries(database, [])).toEqual([]);
    const { webhook, delivery } = await addDelivery(database);
    expect(delivery.payload).toEqual({ id: "a" });
    const { rows, total } = await listDeliveryRows(database, TENANT, webhook.id, {
      limit: 10,
      offset: 0,
    });
    expect(total).toBe(1);
    expect(rows[0]?.id).toBe(delivery.id);
    const found = await findDeliveryRow(database, TENANT, webhook.id, delivery.id);
    expect(found?.status).toBe("pending");
  });

  it("lets only one of two servers claim a delivery", async () => {
    const { database } = handle;
    const { webhook, delivery } = await addDelivery(database);
    expect(await findDueDeliveryIds(database, now, 10)).toEqual([delivery.id]);

    const claims = await Promise.all([
      claimDueDelivery(database, delivery.id, now, leaseUntil),
      claimDueDelivery(database, delivery.id, now, leaseUntil),
    ]);
    const claimed = claims.filter((claim) => claim !== undefined);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.webhook.id).toBe(webhook.id);
    expect(claimed[0]?.delivery.attemptCount).toBe(1);
    expect(await findDueDeliveryIds(database, now, 10)).toEqual([]);
  });

  it("records how an attempt went", async () => {
    const { database } = handle;
    const { webhook, delivery } = await addDelivery(database);
    await recordDeliveryAttempt(database, delivery.id, {
      status: "failed",
      nextAttemptAt: null,
      responseStatus: 500,
      responseSummary: "Server error",
    });
    const found = await findDeliveryRow(database, TENANT, webhook.id, delivery.id);
    expect(found).toMatchObject({ status: "failed", responseStatus: 500 });
  });
});
