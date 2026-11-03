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
});
