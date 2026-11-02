import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../testing/renderScreen.js";
import { SettingsPage } from "./SettingsPage.js";

describe("Settings", () => {
  it("offers the email outbox to owners", async () => {
    renderScreen(<SettingsPage />, { permissions: ["*"] });

    expect(await screen.findByRole("link", { name: /Email outbox/ })).toBeInTheDocument();
  });

  // LINTEL-SEC-001: the outbox holds other people's sign-in links.
  it("doesn't offer the email outbox to someone who can only see settings", async () => {
    renderScreen(<SettingsPage />, { permissions: ["settings:read", "security:read"] });

    expect(await screen.findByRole("link", { name: /Security log/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Email outbox/ })).not.toBeInTheDocument();
  });

  // The website's settings sat last, under API access and Webhooks, beside a roadmap note.
  it("puts the website's own settings first, with no roadmap placeholder", async () => {
    renderScreen(<SettingsPage />, { permissions: ["*"] });

    await screen.findByRole("link", { name: /Email outbox/ });
    const groups = screen.getAllByRole("list").map((list) => list.getAttribute("aria-labelledby"));
    const firstGroup = document.getElementById(groups[0] ?? "");
    expect(firstGroup).toHaveTextContent("Site");
    expect(screen.queryByText(/roadmap/)).not.toBeInTheDocument();
  });
});
