import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiErrorResponse, mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { DeliveryLog } from "./DeliveryLog.js";
import type { Webhook, WebhookDelivery } from "./webhooks.api.js";
import { WebhookDetailPage } from "./WebhookDetailPage.js";
import { WebhooksPage } from "./WebhooksPage.js";

const siteBuilder: Webhook = {
  id: "w1",
  name: "Site builder",
  url: "https://builder.example.com/hooks/lintel",
  events: ["entry.published", "entry.unpublished"],
  enabled: true,
  secret: "whsec_secret",
  createdAt: "2026-10-30T09:00:00Z",
  lastDelivery: { status: "failed", createdAt: "2026-10-31T09:00:00Z" },
};

const failedDelivery: WebhookDelivery = {
  id: "d1",
  event: "entry.published",
  status: "failed",
  attemptCount: 6,
  nextAttemptAt: null,
  lastAttemptAt: "2026-10-31T21:00:00Z",
  responseStatus: 500,
  responseSummary: "Internal Server Error",
  createdAt: "2026-10-31T09:00:00Z",
  payload: { event: "entry.published", data: { entry: { slug: "hello" } } },
};

afterEach(() => vi.restoreAllMocks());

describe("the webhooks screen", () => {
  it("explains webhooks when there are none, and adds one with chosen events", async () => {
    const { calls } = mockApi(({ method, url, body }) => {
      if (url.pathname === "/webhooks" && method === "GET") return { webhooks: [] };
      if (url.pathname === "/webhooks" && method === "POST") {
        const { url: address } = body as { url: string };
        if (address.includes("localhost")) {
          throw apiErrorResponse(
            400,
            "PRIVATE_WEBHOOK_ADDRESS",
            "Webhooks can't be sent to localhost.",
          );
        }
        return { ...siteBuilder, ...(body as object) };
      }
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    renderScreen(<WebhooksPage />);

    expect(await screen.findByText("No webhooks yet")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add webhook" }));
    const dialog = screen.getByRole("dialog", { name: "Add a webhook" });
    await userEvent.type(within(dialog).getByLabelText("Address"), "http://localhost:3000/hook");
    await userEvent.click(within(dialog).getByRole("switch", { name: "A file is uploaded" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Add webhook" }));

    expect(
      await within(dialog).findByText("Webhooks can't be sent to localhost."),
    ).toBeInTheDocument();
    expect(calls.find((call) => call.method === "POST")?.body).toEqual({
      name: "",
      url: "http://localhost:3000/hook",
      events: ["entry.published", "asset.uploaded"],
    });
  });

  it("asks for at least one event", async () => {
    mockApi(() => ({ webhooks: [] }));
    renderScreen(<WebhooksPage />);

    expect(await screen.findByText("No webhooks yet")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add webhook" }));
    const dialog = screen.getByRole("dialog", { name: "Add a webhook" });
    await userEvent.type(within(dialog).getByLabelText("Address"), "https://example.com/hook");
    await userEvent.click(within(dialog).getByRole("switch", { name: "An entry is published" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Add webhook" }));

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Choose at least one thing to send.",
    );
  });

  it("lists webhooks with how their last delivery went", async () => {
    mockApi(() => ({ webhooks: [siteBuilder] }));
    renderScreen(<WebhooksPage />);

    const row = (await screen.findByText("Site builder")).closest("li");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("Failed")).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText(/2 events/)).toBeInTheDocument();
  });
});

describe("the delivery log", () => {
  it("says what happened and resends a delivery", async () => {
    const { calls } = mockApi(({ method, url }) => {
      if (url.pathname === "/webhooks/w1/deliveries")
        return { deliveries: [failedDelivery], total: 1 };
      if (method === "POST")
        return { ...failedDelivery, id: "d2", status: "pending", attemptCount: 0 };
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    renderScreen(<DeliveryLog webhookId="w1" canResend />);

    await userEvent.click(await screen.findByText("An entry is published"));
    expect(
      screen.getByText("Gave up after 6 tries. Check the receiver, then resend."),
    ).toBeInTheDocument();
    expect(screen.getByText("Internal Server Error")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Resend" }));

    expect(calls.some((call) => call.url.pathname === "/webhooks/w1/deliveries/d1/resend")).toBe(
      true,
    );
  });

  // LINTEL-SEC-012: the API now leaves the secret out for people who can only see settings.
  it("says who can see the signing secret when it isn't sent", async () => {
    mockApi(({ url }) =>
      url.pathname.endsWith("/deliveries")
        ? { deliveries: [], total: 0, page: 1, perPage: 25 }
        : { ...siteBuilder, secret: null },
    );
    renderScreen(<WebhookDetailPage webhookId="w1" />, { permissions: ["settings:read"] });

    expect(
      await screen.findByText("Only people who can change webhooks can see the signing secret."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Copy/ })).not.toBeInTheDocument();
  });
});
