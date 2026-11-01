import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiErrorResponse, mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { FeaturesSettingsPage } from "./FeaturesSettingsPage.js";

const registry = [
  { id: "blog", name: "Blog", description: "Posts, categories and tags." },
  { id: "commerce", name: "Online shop", description: "Products, orders and payments." },
  { id: "forms", name: "Forms", description: "Contact forms and submissions." },
  { id: "seo", name: "SEO tools", description: "Page titles, sitemaps and redirects." },
];

/** A fake plugin API that remembers what is switched on. */
function fakePluginApi(initiallyOn: string[], failPut = false) {
  let enabled = initiallyOn;
  const list = () => ({
    plugins: registry.map((plugin) => ({ ...plugin, enabled: enabled.includes(plugin.id) })),
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
});
