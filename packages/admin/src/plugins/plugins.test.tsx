import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarDays } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FieldEditor } from "../fields/FieldEditor.js";
import type { Field } from "../fields/field.types.js";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { defineAdminPlugin, type PluginScreenProps } from "./adminPlugin.js";
import { AdminPluginsContext } from "./AdminPluginsContext.js";
import { createTranslator } from "./createTranslator.js";
import { matchScreenPath } from "./matchScreenPath.js";
import { PluginScreenRoute } from "./PluginScreenRoute.js";
import { PluginSettingsRows } from "./PluginSettingsRows.js";
import { SectionTabs } from "./SectionTabs.js";

/** A small plugin of the kind a developer would write, using every kind of contribution. */
const bookings = defineAdminPlugin({
  id: "bookings",
  sidebarItems: [{ path: "/bookings", label: "Bookings", icon: CalendarDays }],
  screens: [
    { path: "/bookings", component: () => <h1>All bookings</h1>, permission: "bookings:read" },
    {
      path: "/bookings/$bookingId",
      component: ({ params }: PluginScreenProps) => <h1>Booking {params.bookingId}</h1>,
    },
    { path: "/bookings/settings", component: () => <h1>Booking settings</h1> },
  ],
  settingsRows: [
    {
      group: "Bookings",
      label: "Bookings",
      description: "The usual length",
      icon: CalendarDays,
      to: "/bookings/settings",
    },
  ],
  dashboardTabs: [
    { section: "/", id: "week", label: "This week", component: () => <p>Three bookings</p> },
    { section: "/content", id: "other", label: "Elsewhere", component: () => <p>Not here</p> },
  ],
  fieldEditors: [
    {
      type: "bookings.duration",
      Editor: ({ controlId, value }) => <input id={controlId} defaultValue={String(value)} />,
    },
  ],
});

function renderWithPlugins(
  ui: React.ReactNode,
  options: Parameters<typeof renderScreen>[1] = { enabledPlugins: ["bookings"] },
) {
  return renderScreen(
    <AdminPluginsContext.Provider value={[bookings]}>{ui}</AdminPluginsContext.Provider>,
    options,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("plugin screens", () => {
  it("match addresses, with $name parts handed to the screen", () => {
    expect(matchScreenPath("/bookings/$bookingId", "/bookings/42/")).toEqual({ bookingId: "42" });
    expect(matchScreenPath("/bookings/$bookingId", "/bookings")).toBeUndefined();
    expect(matchScreenPath("/bookings", "/orders")).toBeUndefined();
  });

  it("show the screen for the address, preferring fixed paths to $name ones", async () => {
    renderWithPlugins(<PluginScreenRoute />, {
      enabledPlugins: ["bookings"],
      initialPath: "/bookings/settings",
    });
    expect(await screen.findByRole("heading", { name: "Booking settings" })).toBeInTheDocument();
  });

  it("hand $name parts to the screen", async () => {
    renderWithPlugins(<PluginScreenRoute />, {
      enabledPlugins: ["bookings"],
      initialPath: "/bookings/b-7",
    });
    expect(await screen.findByRole("heading", { name: "Booking b-7" })).toBeInTheDocument();
  });

  it("say the page isn't here while the plugin is off, or without its permission", async () => {
    renderWithPlugins(<PluginScreenRoute />, {
      enabledPlugins: [],
      initialPath: "/bookings/b-7",
    });
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });

  it("need the permission a screen names", async () => {
    renderWithPlugins(<PluginScreenRoute />, {
      enabledPlugins: ["bookings"],
      permissions: ["entries:read"],
      initialPath: "/bookings",
    });
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });
});

describe("section tabs", () => {
  it("are only drawn when a plugin adds one to the section", async () => {
    renderWithPlugins(
      <SectionTabs section="/settings">
        <h1>Settings</h1>
      </SectionTabs>,
    );
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("follow the ARIA tabs pattern, with the section's own screen first", async () => {
    renderWithPlugins(
      <SectionTabs section="/">
        <h1>Dashboard</h1>
      </SectionTabs>,
    );
    const overview = await screen.findByRole("tab", { name: "Overview" });
    expect(overview).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "Elsewhere" })).not.toBeInTheDocument();

    overview.focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "This week" })).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Three bookings");
    expect(screen.getByRole("heading", { level: 1, name: "This week" })).toBeInTheDocument();
  });
});

describe("other contributions", () => {
  it("add settings rows in their own group", async () => {
    renderWithPlugins(<PluginSettingsRows />);
    expect(await screen.findByRole("link", { name: /Bookings/ })).toHaveAttribute(
      "href",
      "/bookings/settings",
    );
  });

  it("give a plugin's fieldtype its editor, labelled like any other field", async () => {
    mockApi(() => ({}));
    const field: Field = {
      handle: "length",
      label: "Length",
      type: "bookings.duration" as Field["type"],
      required: false,
      helpText: "",
      options: {},
    };
    renderWithPlugins(<FieldEditor field={field} value={45} onChange={() => {}} />);
    expect(await screen.findByLabelText("Length")).toHaveValue("45");
  });

  it("bring their own words through createTranslator", () => {
    const t = createTranslator({ "bookings.count": "{count} today" });
    expect(t("bookings.count", { count: 3 })).toBe("3 today");
  });
});
