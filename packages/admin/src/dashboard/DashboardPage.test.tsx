import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarClock } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineAdminPlugin } from "../plugins/adminPlugin.js";
import { AdminPluginsContext } from "../plugins/AdminPluginsContext.js";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { DashboardPage } from "./DashboardPage.js";
import type { WidgetPlacement } from "./dashboardLayout.js";

const bookings = defineAdminPlugin({
  id: "bookings",
  dashboardWidgets: [
    {
      id: "today",
      title: "Today’s bookings",
      description: "Who is coming in today.",
      icon: CalendarClock,
      component: () => <p>Grace at 10:00</p>,
      defaultSize: "small",
      permission: "bookings:read",
    },
  ],
});

function serveDashboard(saved: WidgetPlacement[] | null = null) {
  return mockApi(({ method, url, body }) => {
    if (url.pathname === "/dashboard/layout" && method === "GET") {
      return { widgets: saved, source: saved ? "user" : "default" };
    }
    if (url.pathname === "/dashboard/layout" && method === "PUT") {
      return { ...(body as object), source: "user" };
    }
    if (url.pathname === "/dashboard/layout" && method === "DELETE") {
      return { widgets: null, source: "default" };
    }
    if (url.pathname === "/dashboard/widgets/media-usage") {
      return { fileCount: 2, totalBytes: 2_500_000, imageCount: 2, imagesWithoutAltText: 1 };
    }
    if (url.pathname.startsWith("/dashboard/widgets/")) return { entries: [], total: 0 };
    throw new Error(`Unexpected request: ${method} ${url.pathname}`);
  });
}

function renderDashboard(options: { permissions?: string[]; enabledPlugins?: string[] } = {}) {
  return renderScreen(
    <AdminPluginsContext.Provider value={[bookings]}>
      <DashboardPage />
    </AdminPluginsContext.Provider>,
    options,
  );
}

function widgetTitles() {
  return screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
}

afterEach(() => vi.restoreAllMocks());

describe("the home dashboard", () => {
  it("starts from Lintel's default widgets, leaving out the ones someone can't use", async () => {
    serveDashboard();
    renderDashboard({ permissions: ["entries:read"] });

    // The first screen in a file also loads the widgets' code, so it may take a moment.
    expect(
      await screen.findByRole("heading", { name: "Recent edits" }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(widgetTitles()).toEqual([
      "Welcome",
      "Recent edits",
      "Drafts needing attention",
      "Scheduled",
    ]);
  });

  it("shows a plugin's widget only while the plugin is on and to people allowed", async () => {
    const placed: WidgetPlacement[] = [
      { widget: "core:welcome", size: "large" },
      { widget: "bookings:today", size: "small" },
    ];
    serveDashboard(placed);
    renderDashboard({ enabledPlugins: ["bookings"] });
    expect(await screen.findByText("Grace at 10:00")).toBeInTheDocument();
  });

  it("hides a plugin's widget while the plugin is off, and keeps it in the saved layout", async () => {
    const placed: WidgetPlacement[] = [
      { widget: "bookings:today", size: "small" },
      { widget: "core:welcome", size: "large" },
      { widget: "core:media-usage", size: "small" },
    ];
    const { calls } = serveDashboard(placed);
    renderDashboard({ enabledPlugins: [] });

    await screen.findByRole("heading", { name: "Welcome" });
    expect(screen.queryByText("Grace at 10:00")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Edit dashboard" }));
    await userEvent.click(screen.getByRole("button", { name: "Move Media usage earlier" }));
    expect(screen.getByText("Media usage moved to position 1 of 2.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() =>
      expect(calls.find((call) => call.method === "PUT")?.body).toEqual({
        widgets: [
          { widget: "core:media-usage", size: "small" },
          { widget: "core:welcome", size: "large" },
          { widget: "bookings:today", size: "small" },
        ],
      }),
    );
  });

  it("lets people resize, remove and add widgets, and saves only when they press Done", async () => {
    const { calls } = serveDashboard([{ widget: "core:welcome", size: "large" }]);
    renderDashboard({ enabledPlugins: ["bookings"] });

    await userEvent.click(await screen.findByRole("button", { name: "Edit dashboard" }));
    await userEvent.click(
      within(screen.getByRole("radiogroup", { name: "Size of Welcome" })).getByRole("radio", {
        name: "Medium",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Add widget" }));
    await userEvent.click(screen.getByRole("button", { name: "Add Today’s bookings" }));
    expect(screen.getByText("Today’s bookings added to your dashboard.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add widget" }));
    await userEvent.click(screen.getByRole("button", { name: "Add Media usage" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove Media usage" }));
    expect(calls.some((call) => call.method === "PUT")).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() =>
      expect(calls.find((call) => call.method === "PUT")?.body).toEqual({
        widgets: [
          { widget: "core:welcome", size: "medium" },
          { widget: "bookings:today", size: "small" },
        ],
      }),
    );
    expect(await screen.findByRole("button", { name: "Edit dashboard" })).toBeInTheDocument();
  });

  it("throws changes away on Cancel, and resets to the default after asking", async () => {
    const { calls } = serveDashboard([{ widget: "core:welcome", size: "large" }]);
    renderDashboard();

    await userEvent.click(await screen.findByRole("button", { name: "Edit dashboard" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove Welcome" }));
    expect(screen.getByText("Your dashboard is empty")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("heading", { name: "Welcome" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Edit dashboard" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset to default" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));

    await waitFor(() => expect(calls.some((call) => call.method === "DELETE")).toBe(true));
    expect(await screen.findByRole("heading", { name: "Media usage" })).toBeInTheDocument();
  });

  it("offers role defaults only to people who can change settings", async () => {
    serveDashboard();
    renderDashboard({ permissions: ["entries:read"] });

    await userEvent.click(await screen.findByRole("button", { name: "Edit dashboard" }));
    expect(screen.queryByRole("button", { name: "Default for a role…" })).not.toBeInTheDocument();
  });

  // LINTEL-UX-027: the button asked for "media:create", which no role has, so Authors (who
  // may upload) never saw it.
  it("offers Add images and files to people who may upload", async () => {
    serveDashboard();
    renderDashboard({
      permissions: ["entries:read", "entries:create", "media:read", "media:upload"],
    });

    expect(
      await screen.findByRole("link", { name: "Add images and files" }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });
});

describe("the dashboard's media widget (QA sweep)", () => {
  it("links the pictures with no description to the media library's filter", async () => {
    serveDashboard();
    renderDashboard();
    const link = await screen.findByRole("link", { name: "1 picture needs a description" });
    expect(link).toHaveAttribute("href", "/media?filter=needs-description");
  });
});
