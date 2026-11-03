import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { SecurityLogPage } from "./SecurityLogPage.js";

afterEach(() => vi.restoreAllMocks());

function serveNoEvents() {
  mockApi(() => ({ events: [], total: 0, page: 1, perPage: 50 }));
}

describe("the security log, in Users", () => {
  it("goes back to Users, and links owners to the emails sent", async () => {
    serveNoEvents();
    renderScreen(<SecurityLogPage />, { permissions: ["*"] });

    expect(await screen.findByRole("link", { name: "Emails sent" })).toHaveAttribute(
      "href",
      "/users/emails",
    );
    expect(screen.getByRole("link", { name: /Users/ })).toHaveAttribute("href", "/users");
  });

  // LINTEL-SEC-001: the outbox holds other people's sign-in links.
  it("doesn't link to the emails sent for someone who isn't an owner", async () => {
    serveNoEvents();
    renderScreen(<SecurityLogPage />, { permissions: ["settings:read", "security:read"] });

    expect(await screen.findByRole("heading", { name: "Security log" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Emails sent" })).not.toBeInTheDocument();
  });

  // The log stopped at 896px however wide the window was.
  it("lets the table use the whole width", async () => {
    mockApi(() => ({
      events: [
        {
          id: "e1",
          kind: "sign_in",
          actor: { id: "u1", email: "sam@bakery.test" },
          subject: null,
          details: {},
          ipAddress: "127.0.0.1",
          userAgent: null,
          createdAt: "2026-11-02T10:54:00Z",
        },
      ],
      total: 1,
      page: 1,
      perPage: 50,
    }));
    renderScreen(<SecurityLogPage />, { permissions: ["*"] });

    const table = await screen.findByRole("table");
    expect(table.closest("[class*='max-w-']")).toBeNull();
  });
});
