import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../testing/renderScreen.js";
import { SettingsPage } from "./SettingsPage.js";

function groupHeaders(): Array<string | null | undefined> {
  return screen
    .getAllByRole("list")
    .map(
      (list) => document.getElementById(list.getAttribute("aria-labelledby") ?? "")?.textContent,
    );
}

describe("Settings", () => {
  // Settings was a catch-all: content types, API keys and the security log sat beside the
  // website's name and address. Those moved to Build, Users and Account.
  it("holds only what a website owner changes, with the website first", async () => {
    renderScreen(<SettingsPage />, { permissions: ["*"] });

    await screen.findByRole("link", { name: /Look and address/ });
    expect(groupHeaders()).toEqual(["Your website", "Looking after your site"]);
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/settings/site",
      "/settings/languages",
      "/settings/publishing",
      "/settings/backups",
      "/settings/updates",
      "/settings/server",
      "/settings/about",
    ]);
    expect(screen.queryByText(/roadmap/)).not.toBeInTheDocument();
  });

  it("finds a setting by what it's for", async () => {
    renderScreen(<SettingsPage />, { permissions: ["*"] });

    await userEvent.type(
      await screen.findByRole("searchbox", { name: "Search settings" }),
      "backup",
    );

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      expect.stringContaining("Backups"),
    ]);
    await userEvent.clear(screen.getByRole("searchbox", { name: "Search settings" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Search settings" }), "zebra");
    expect(screen.getByText("No settings match")).toBeInTheDocument();
  });

  it("says where a setting went, and links to it", async () => {
    renderScreen(<SettingsPage />, { permissions: ["*"] });

    await userEvent.type(
      await screen.findByRole("searchbox", { name: "Search settings" }),
      "webhooks",
    );

    expect(screen.getByText("Webhooks is now in Build")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Webhooks/ })).toHaveAttribute(
      "href",
      "/build/webhooks",
    );
    expect(screen.queryByText("No settings match")).not.toBeInTheDocument();
  });
});
