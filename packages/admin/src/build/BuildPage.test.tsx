import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../testing/renderScreen.js";
import { BuildPage } from "./BuildPage.js";

describe("Build", () => {
  it("lists how the site is put together, in three groups", async () => {
    renderScreen(<BuildPage />, { permissions: ["*"] });

    expect(await screen.findByRole("heading", { level: 1, name: "Build" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "What the site is made of" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Websites and branding" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Connecting and moving" })).toBeInTheDocument();
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/build/content-types",
      "/build/features",
      "/build/sites",
      "/build/branding",
      "/build/api",
      "/build/webhooks",
      "/build/import",
    ]);
  });

  it("shows each row only to people allowed to use it", async () => {
    renderScreen(<BuildPage />, { permissions: ["blueprints:update", "blueprints:read"] });

    expect(await screen.findByRole("link", { name: /Content types/ })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("list", { name: "Connecting and moving" })).not.toBeInTheDocument();
  });
});
