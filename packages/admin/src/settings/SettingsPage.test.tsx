import userEvent from "@testing-library/user-event";
import { screen, within } from "@testing-library/react";
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
    expect(firstGroup).toHaveTextContent("Your website");
    expect(screen.queryByText(/roadmap/)).not.toBeInTheDocument();
  });

  it("finds a setting by what it's for", async () => {
    renderScreen(<SettingsPage />, { permissions: ["*"] });

    await userEvent.type(
      await screen.findByRole("searchbox", { name: "Search settings" }),
      "backup",
    );

    // "Backups and moving" is the group, so Import comes along.
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      expect.stringContaining("Backups"),
      expect.stringContaining("Import"),
    ]);
    await userEvent.clear(screen.getByRole("searchbox", { name: "Search settings" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Search settings" }), "zebra");
    expect(screen.getByText("No settings match")).toBeInTheDocument();
  });

  // Logo and colour were in two places, and settings agencies set up once sat second and
  // third, where clients look first.
  it("groups settings by what they're for, with the agency's set-up last", async () => {
    renderScreen(<SettingsPage />, { permissions: ["*"] });

    await screen.findByRole("link", { name: /Email outbox/ });
    const headers = screen
      .getAllByRole("list")
      .map(
        (list) => document.getElementById(list.getAttribute("aria-labelledby") ?? "")?.textContent,
      );
    expect(headers).toEqual([
      "Your website",
      "Security and email",
      "Backups and moving",
      "Set up by whoever built your site",
      "For developers",
      "Lintel itself",
    ]);
    const builtGroup = screen.getByRole("list", { name: "Set up by whoever built your site" });
    expect(within(builtGroup).getAllByRole("link")).toHaveLength(4);
    expect(within(builtGroup).getByRole("link", { name: /Admin branding/ })).toBeInTheDocument();
    expect(
      within(builtGroup).getByRole("link", { name: /Websites and domains/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/check with whoever built it before changing them/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Interface language/ })).not.toBeInTheDocument();
  });
});
