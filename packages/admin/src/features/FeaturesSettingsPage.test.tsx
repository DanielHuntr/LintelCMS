import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiErrorResponse, mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { Feature } from "./features.api.js";
import { FeaturesSettingsPage } from "./FeaturesSettingsPage.js";

type ListedFeature = Omit<Feature, "enabled">;

function feature(id: string, name: string, description: string): ListedFeature {
  return {
    id,
    name,
    description,
    source: "built-in",
    version: null,
    permissions: [],
    hasSettings: false,
  };
}

const builtIn = [
  feature("blog", "Blog", "Posts, categories and tags."),
  feature("commerce", "Online shop", "Products, orders and payments."),
  feature("forms", "Forms", "Contact forms and submissions."),
  feature("seo", "SEO tools", "Page titles, sitemaps and redirects."),
];

const bookings: ListedFeature = {
  ...feature("bookings", "Bookings", "Appointments people book on your website."),
  source: "installed",
  version: "0.1.0",
};

/** A fake plugin API that remembers what is switched on. */
function fakePluginApi(initiallyOn: string[], failPut = false, installed: ListedFeature[] = []) {
  let enabled = initiallyOn;
  const list = () => ({
    plugins: [...builtIn, ...installed].map((plugin) => ({
      ...plugin,
      enabled: enabled.includes(plugin.id),
    })),
  });
  return mockApi(({ method, url, body }) => {
    if (url.pathname !== "/plugins") throw new Response(null, { status: 404 });
    if (method === "PUT") {
      if (failPut) throw apiErrorResponse(400, "INVALID_REQUEST", "That didn't save.");
      enabled = (body as { enabled: string[] }).enabled;
    }
    return list();
  });
}

function toggle(name: string) {
  return screen.findByRole("switch", { name });
}

afterEach(() => vi.restoreAllMocks());

describe("FeaturesSettingsPage", () => {
  it("lists every feature with its description and whether it is on", async () => {
    fakePluginApi(["forms", "seo"]);
    renderScreen(<FeaturesSettingsPage />);

    expect(await toggle("Blog")).not.toBeChecked();
    expect(await toggle("SEO tools")).toBeChecked();
    expect(screen.getByText("Products, orders and payments.")).toBeVisible();
  });

  it("saves a switch straight away, says so, and can undo it", async () => {
    const { calls } = fakePluginApi(["forms", "seo"]);
    renderScreen(<FeaturesSettingsPage />);

    await userEvent.click(await toggle("Blog"));

    expect(await screen.findByText("Saved")).toBeVisible();
    expect(calls.find((call) => call.method === "PUT")?.body).toEqual({
      enabled: ["blog", "forms", "seo"],
    });
    expect(await toggle("Blog")).toBeChecked();

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await vi.waitFor(async () => expect(await toggle("Blog")).not.toBeChecked());
    expect(calls.filter((call) => call.method === "PUT").at(-1)?.body).toEqual({
      enabled: ["forms", "seo"],
    });
  });

  it("asks before switching off something with content, and says the content is kept", async () => {
    const { calls } = fakePluginApi(["blog", "seo"]);
    renderScreen(<FeaturesSettingsPage />);

    await userEvent.click(await toggle("Blog"));

    expect(
      screen.getByText(
        "Your posts are kept; the Blog section just hides. Switch it back on any time.",
      ),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Keep it on" }));
    expect(calls.some((call) => call.method === "PUT")).toBe(false);

    await userEvent.click(await toggle("Blog"));
    await userEvent.click(screen.getByRole("button", { name: "Switch off" }));
    expect(await screen.findByText("Saved")).toBeVisible();
    expect(await toggle("Blog")).not.toBeChecked();
  });

  it("switches off a feature without content straight away", async () => {
    fakePluginApi(["seo"]);
    renderScreen(<FeaturesSettingsPage />);

    await userEvent.click(await toggle("SEO tools"));

    expect(await screen.findByText("Saved")).toBeVisible();
  });

  it("shows a problem saving calmly", async () => {
    fakePluginApi([], true);
    renderScreen(<FeaturesSettingsPage />);

    await userEvent.click(await toggle("SEO tools"));

    expect(await screen.findByText("That didn't save.")).toBeVisible();
  });

  it("shows the switches disabled to someone who can only look", async () => {
    fakePluginApi(["seo"]);
    renderScreen(<FeaturesSettingsPage />, { permissions: ["settings:read"] });

    expect(await toggle("SEO tools")).toBeDisabled();
    expect(
      screen.getByText("Ask an admin if you need a feature switched on or off."),
    ).toBeVisible();
  });

  it("lists installed features apart, with their version, and asks before switching one off", async () => {
    const { calls } = fakePluginApi(["seo", "bookings"], false, [bookings]);
    renderScreen(<FeaturesSettingsPage />);

    expect(await toggle("Bookings")).toBeChecked();
    expect(screen.getByText("Built into Lintel")).toBeVisible();
    expect(screen.getByText("Added by your developer")).toBeVisible();
    expect(screen.getByText("Version 0.1.0")).toBeVisible();

    await userEvent.click(await toggle("Bookings"));
    expect(
      screen.getByText(
        "Anything it saved is kept; its screens just hide. Switch it back on any time.",
      ),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Switch off" }));

    expect(await screen.findByText("Saved")).toBeVisible();
    expect(calls.find((call) => call.method === "PUT")?.body).toEqual({ enabled: ["seo"] });
  });

  it("switches an installed feature on, keeping the others as they were", async () => {
    const { calls } = fakePluginApi(["blog"], false, [bookings]);
    renderScreen(<FeaturesSettingsPage />);

    await userEvent.click(await toggle("Bookings"));

    expect(await screen.findByText("Saved")).toBeVisible();
    expect(calls.find((call) => call.method === "PUT")?.body).toEqual({
      enabled: ["blog", "bookings"],
    });
  });
});
