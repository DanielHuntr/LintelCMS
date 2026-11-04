import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LucideIcon } from "lucide-react";
import type { AdminPluginDefinition } from "../plugins/adminPlugin.js";
import { AdminPluginsContext } from "../plugins/AdminPluginsContext.js";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { Addon, AddonDetails } from "./addons.api.js";
import { AddonsPage } from "./AddonsPage.js";

const swatches: Addon = {
  id: "swatches",
  name: "Colour swatches",
  description: "Pick brand colours for products.",
  packageName: "@acme/lintel-swatches",
  version: "1.2.0",
  from: "npm",
  enabled: false,
  adds: ["fieldtypes", "liquid", "settings"],
  permissions: [],
  settingsSchema: {
    type: "object",
    properties: { greeting: { type: "string" }, showNames: { type: "boolean" } },
  },
  problem: null,
};

const broken: Addon = {
  ...swatches,
  id: "old-thing",
  name: "old-thing",
  description: "",
  adds: [],
  settingsSchema: null,
  problem: "It works with Lintel >=99.0.0, and this is Lintel 1.0.0-rc.1.",
};

const details: AddonDetails = {
  id: "swatches",
  stores: {
    tables: [
      {
        name: "swatches_palettes",
        purpose: "Saved colour palettes.",
        columns: [
          { name: "made_by", purpose: "Who made it.", personalData: true, checked: true },
          { name: "colours", purpose: "The colours.", personalData: false, checked: true },
        ],
        checked: true,
        rows: 2,
        bytes: 16_000,
      },
    ],
    undeclared: [{ name: "swatches_cache", rows: 4, bytes: 8_000 }],
    settings: true,
  },
  website: {
    publicRoutes: [
      { method: "GET", path: "/swatches", purpose: "The palettes.", checked: true },
      { method: "GET", path: "/swatches/old", purpose: "Old palettes.", checked: false },
    ],
    otherRoutes: 2,
    adminScreens: true,
    blocks: [],
  },
  runs: {
    jobs: [
      {
        id: "tidy",
        name: "Tidying",
        everyMinutes: 1440,
        purpose: "Tidies old palettes.",
        lastRunAt: null,
        lastError: "The disk is full",
        checked: true,
      },
    ],
    events: [],
  },
  talksTo: {
    hosts: [{ host: "colours.example", purpose: "Looks up colour names." }],
    consentServices: ["Colour Co"],
    consentFromSettings: false,
  },
  origin: {
    packageName: "@acme/lintel-swatches",
    version: "1.2.0",
    publisher: "Acme",
    licence: "MIT",
    source: "https://github.com/acme/swatches",
    integrity: "sha512-abc",
    fingerprint: "sha256-def",
  },
  permissions: [],
};

function fakeApi(addons: Addon[]) {
  let enabled: string[] = addons.filter((addon) => addon.enabled).map((addon) => addon.id ?? "");
  let settings: Record<string, unknown> = { greeting: "Hello", showNames: true };
  return mockApi(({ method, url, body }) => {
    if (url.pathname === "/addons") {
      return {
        addons: addons.map((addon) => ({ ...addon, enabled: enabled.includes(addon.id ?? "") })),
        folder: "/srv/lintel/.lintel/addons",
      };
    }
    if (url.pathname === "/plugins") {
      if (method === "PUT") enabled = (body as { enabled: string[] }).enabled;
      return {
        plugins: ["blog", "swatches"].map((id) => ({
          id,
          name: id,
          description: "",
          enabled: enabled.includes(id),
          source: "installed",
          version: null,
          permissions: [],
          hasSettings: false,
        })),
      };
    }
    if (url.pathname === "/addons/swatches/details") return details;
    if (url.pathname === "/addons/swatches/delete-data") return { emptied: ["swatches_palettes"] };
    if (url.pathname === "/plugins/swatches/settings") {
      if (method === "PUT") settings = body as Record<string, unknown>;
      return settings;
    }
    throw new Response(null, { status: 404 });
  });
}

afterEach(() => vi.restoreAllMocks());

describe("AddonsPage", () => {
  it("says what add-ons are when there are none", async () => {
    fakeApi([]);
    renderScreen(<AddonsPage />);
    expect(await screen.findByText("No add-ons yet")).toBeVisible();
  });

  it("lists add-ons with whether they are on, and the ones that can't run apart", async () => {
    fakeApi([swatches, broken]);
    renderScreen(<AddonsPage />);

    const row = await screen.findByRole("button", { name: /Colour swatches/ });
    expect(within(row).getByText("Off")).toBeVisible();
    expect(screen.getByText("Need attention")).toBeVisible();
    expect(screen.getByText(/It works with Lintel >=99\.0\.0/)).toBeVisible();
  });

  it("opens an add-on to switch it on, see what it can reach and change its settings", async () => {
    const { calls } = fakeApi([swatches]);
    renderScreen(<AddonsPage />);

    await userEvent.click(await screen.findByRole("button", { name: /Colour swatches/ }));
    const dialog = await screen.findByRole("dialog", { name: "Colour swatches" });
    await within(dialog).findByText("swatches_palettes");
    expect(within(dialog).getByText(/full access to its content/)).toBeVisible();
    await userEvent.click(within(dialog).getByText("What it adds"));
    expect(within(dialog).getByText("Kinds of field for content types")).toBeVisible();
    await userEvent.click(within(dialog).getByText("Removing it"));
    expect(
      within(dialog).getByText("pnpm lintel addons remove @acme/lintel-swatches"),
    ).toBeVisible();

    await userEvent.click(within(dialog).getByRole("switch", { name: "Use Colour swatches" }));
    await vi.waitFor(() =>
      expect(
        calls.find((call) => call.method === "PUT" && call.url.pathname === "/plugins")?.body,
      ).toEqual({ enabled: ["swatches"] }),
    );

    await userEvent.click(within(dialog).getByText("Settings"));
    const greeting = await within(dialog).findByRole("textbox", { name: "Greeting" });
    expect(greeting).toHaveValue("Hello");
    await userEvent.clear(greeting);
    await userEvent.type(greeting, "Hi there");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save settings" }));

    expect(await within(dialog).findByText("Settings saved")).toBeVisible();
    expect(
      calls.find(
        (call) => call.method === "PUT" && call.url.pathname === "/plugins/swatches/settings",
      )?.body,
    ).toEqual({ greeting: "Hi there", showNames: true });
  });

  it("shows what it stores first, and marks what Lintel checked and what it only says", async () => {
    fakeApi([swatches]);
    renderScreen(<AddonsPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Colour swatches/ }));
    const dialog = await screen.findByRole("dialog", { name: "Colour swatches" });

    // Stored data is open; everything else is folded.
    expect(await within(dialog).findByText("Saved colour palettes.")).toBeVisible();
    expect(within(dialog).getByText("Personal data")).toBeVisible();
    expect(within(dialog).getByText(/2 rows · 16 kB/)).toBeVisible();
    expect(within(dialog).getByText(/tables it doesn’t describe: swatches_cache/)).toBeVisible();
    expect(within(dialog).getByText("colours.example")).not.toBeVisible();

    await userEvent.click(within(dialog).getByText("What it adds"));
    const address = within(dialog).getByText("GET /swatches").closest("li");
    expect(address).toHaveTextContent("Checked by Lintel");
    const missing = within(dialog).getByText("GET /swatches/old").closest("li");
    expect(missing).toHaveTextContent("Says the add-on");
    expect(missing).toHaveTextContent("not found");

    await userEvent.click(within(dialog).getByText("What runs by itself"));
    expect(within(dialog).getByText(/Every day/)).toBeVisible();
    expect(within(dialog).getByText(/The disk is full/)).toBeVisible();

    await userEvent.click(within(dialog).getByText("Who it talks to"));
    expect(within(dialog).getByText("colours.example").closest("li")).toHaveTextContent(
      "Says the add-on",
    );
    expect(within(dialog).getByText(/cookie notice asks visitors about Colour Co/)).toBeVisible();

    await userEvent.click(within(dialog).getByText("Where it comes from"));
    expect(within(dialog).getByText("sha256-def")).toBeVisible();
    expect(within(dialog).getByRole("link", { name: /github.com/ })).toHaveAttribute(
      "href",
      "https://github.com/acme/swatches",
    );
  });

  describe("its own screen", () => {
    const withScreen = (definition: AdminPluginDefinition) => (
      <AdminPluginsContext.Provider value={[definition]}>
        <AddonsPage />
      </AdminPluginsContext.Provider>
    );
    const open = async (definition: AdminPluginDefinition, enabledPlugins: string[]) => {
      fakeApi([{ ...swatches, enabled: enabledPlugins.includes("swatches") }]);
      renderScreen(withScreen(definition), { enabledPlugins });
      await userEvent.click(await screen.findByRole("button", { name: /Colour swatches/ }));
      return screen.findByRole("dialog", { name: "Colour swatches" });
    };
    const icon = (() => null) as unknown as LucideIcon;

    it("links to its sidebar screen", async () => {
      const dialog = await open(
        { id: "swatches", sidebarItems: [{ path: "/swatches", label: "Swatches", icon }] },
        ["swatches"],
      );
      expect(within(dialog).getByRole("link", { name: "Open Colour swatches" })).toHaveAttribute(
        "href",
        "/swatches",
      );
    });

    it("underlines the link without a hover, so it reads as one (LINTEL-UX-286)", async () => {
      const dialog = await open(
        { id: "swatches", sidebarItems: [{ path: "/swatches", label: "Swatches", icon }] },
        ["swatches"],
      );
      const classes = within(dialog)
        .getByRole("link", { name: "Open Colour swatches" })
        .className.split(" ");
      expect(classes).toContain("underline");
      expect(classes).not.toContain("hover:underline");
    });

    it("links to its row in Settings when it has no sidebar link", async () => {
      const row = { group: "Add-ons", label: "Swatches", description: "", icon };
      const dialog = await open(
        { id: "swatches", settingsRows: [{ ...row, to: "/settings/swatches" }] },
        ["swatches"],
      );
      expect(within(dialog).getByRole("link", { name: "Open Colour swatches" })).toHaveAttribute(
        "href",
        "/settings/swatches",
      );
    });

    it("links to a screen at a plain address when that's all it has", async () => {
      const component = () => null;
      const dialog = await open(
        {
          id: "swatches",
          screens: [
            { path: "/swatches/$swatchId", component },
            { path: "/swatches", component },
          ],
        },
        ["swatches"],
      );
      expect(within(dialog).getByRole("link", { name: "Open Colour swatches" })).toHaveAttribute(
        "href",
        "/swatches",
      );
    });

    it("offers no link while it's off", async () => {
      const off = await open(
        { id: "swatches", sidebarItems: [{ path: "/swatches", label: "Swatches", icon }] },
        [],
      );
      expect(within(off).queryByRole("link", { name: /^Open/ })).not.toBeInTheDocument();
    });

    it("offers no link to a screen that needs an address", async () => {
      const dialog = await open(
        { id: "swatches", screens: [{ path: "/swatches/$swatchId", component: () => null }] },
        ["swatches"],
      );
      expect(within(dialog).queryByRole("link", { name: /^Open/ })).not.toBeInTheDocument();
    });
  });

  it("offers an export, then keeping or deleting its data, once it is off", async () => {
    const { calls } = fakeApi([{ ...swatches, enabled: true }]);
    renderScreen(<AddonsPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Colour swatches/ }));
    const dialog = await screen.findByRole("dialog", { name: "Colour swatches" });
    await within(dialog).findByText("swatches_palettes");
    await userEvent.click(within(dialog).getByText("Removing it"));

    expect(within(dialog).getByRole("link", { name: "All of it (JSON)" })).toHaveAttribute(
      "href",
      expect.stringContaining("/addons/swatches/export?format=json"),
    );
    expect(within(dialog).getByRole("link", { name: "swatches_palettes (CSV)" })).toHaveAttribute(
      "href",
      expect.stringContaining("table=swatches_palettes"),
    );
    expect(within(dialog).getByText("Your backups have its data too.")).toBeVisible();

    await userEvent.click(within(dialog).getByRole("radio", { name: /Delete its data/ }));
    const button = within(dialog).getByRole("button", { name: "Delete its data now" });
    expect(button).toBeDisabled();
    expect(within(dialog).getByText("Switch it off above first.")).toBeVisible();

    await userEvent.click(within(dialog).getByRole("switch", { name: "Use Colour swatches" }));
    await vi.waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    const confirm = await screen.findByRole("alertdialog");
    await userEvent.click(within(confirm).getByRole("button", { name: "Delete its data now" }));
    await vi.waitFor(() =>
      expect(
        calls.find((call) => call.url.pathname === "/addons/swatches/delete-data")?.body,
      ).toEqual({ confirm: "DELETE" }),
    );
  });
});
