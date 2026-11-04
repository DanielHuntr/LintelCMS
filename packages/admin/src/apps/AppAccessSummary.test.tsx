import type { AppManifest } from "@lintel/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppAccessSummary } from "./AppAccessSummary.js";

const page = { label: "Stock", url: "https://app.example.com/page" };

function manifestWith(roles?: NonNullable<AppManifest["admin"]["page"]>["roles"]): AppManifest {
  return {
    name: "Stock Sync",
    handle: "stock-sync",
    description: "Keeps product pages in step with the warehouse.",
    appUrl: "https://app.example.com",
    scopes: [],
    webhooks: [],
    admin: {
      page: roles ? { ...page, roles } : page,
      dashboardWidgets: [],
      editorPanels: [],
    },
  };
}

describe("who an app's page is for, before installing (LINTEL-UX-334)", () => {
  it("says clients and Viewers don't see a page that names no roles", () => {
    render(<AppAccessSummary manifest={manifestWith()} />);

    expect(screen.getByText(/Clients and Viewers don't see it/)).toBeTruthy();
  });

  it("names the roles a page lists, Owners first and once", () => {
    render(<AppAccessSummary manifest={manifestWith(["editor", "owner"])} />);

    expect(screen.getByText("A page in the sidebar: Stock, for Owners, Editors")).toBeTruthy();
  });
});
