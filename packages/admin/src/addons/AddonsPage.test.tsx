import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { Addon } from "./addons.api.js";
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
    expect(within(dialog).getByText("Kinds of field for content types")).toBeVisible();
    expect(within(dialog).getByText(/full access to its content/)).toBeVisible();
    expect(
      within(dialog).getByText("pnpm lintel addons remove @acme/lintel-swatches"),
    ).toBeVisible();

    await userEvent.click(within(dialog).getByRole("switch", { name: "Use Colour swatches" }));
    await vi.waitFor(() =>
      expect(
        calls.find((call) => call.method === "PUT" && call.url.pathname === "/plugins")?.body,
      ).toEqual({ enabled: ["swatches"] }),
    );

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
});
