import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { Feature } from "./features.api.js";
import { FeaturesSettingsPage } from "./FeaturesSettingsPage.js";

function feature(id: string, name: string, extra: Partial<Feature> = {}): Feature {
  return {
    id,
    name,
    description: `${name} for your site.`,
    enabled: false,
    source: "built-in",
    version: null,
    permissions: [],
    hasSettings: false,
    ...extra,
  };
}

function serveFeatures() {
  let features = [
    feature("blog", "Blog", { enabled: true }),
    feature("seo", "SEO tools"),
    feature("bookings", "Bookings", { source: "installed", version: "0.1.0" }),
  ];
  return mockApi(({ method, body }) => {
    if (method === "PUT") {
      const enabled = (body as { enabled: string[] }).enabled;
      features = features.map((each) => ({ ...each, enabled: enabled.includes(each.id) }));
    }
    return { plugins: features };
  });
}

afterEach(() => vi.restoreAllMocks());

describe("Settings → Features", () => {
  it("lists built-in and installed features apart, with the installed one's version", async () => {
    serveFeatures();
    renderScreen(<FeaturesSettingsPage />);

    expect(await screen.findByRole("switch", { name: "Bookings" })).not.toBeChecked();
    expect(screen.getByText("Added by your developer")).toBeInTheDocument();
    expect(screen.getByText("Version 0.1.0")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Blog" })).toBeChecked();
  });

  it("switches a feature on, keeping the others as they were", async () => {
    const { calls } = serveFeatures();
    renderScreen(<FeaturesSettingsPage />);

    await userEvent.click(await screen.findByRole("switch", { name: "Bookings" }));

    await waitFor(() =>
      expect(calls.find((call) => call.method === "PUT")?.body).toEqual({
        enabled: ["blog", "bookings"],
      }),
    );
    expect(await screen.findByText("Bookings is on.")).toBeInTheDocument();
  });

  it("says nothing is deleted when a feature is switched off", async () => {
    serveFeatures();
    renderScreen(<FeaturesSettingsPage />);

    await userEvent.click(await screen.findByRole("switch", { name: "Blog" }));

    expect(
      await screen.findByText("Blog is off. Nothing it made has been deleted."),
    ).toBeInTheDocument();
  });

  it("can be read, but not changed, without settings:update", async () => {
    serveFeatures();
    renderScreen(<FeaturesSettingsPage />, { permissions: ["settings:read"] });

    expect(await screen.findByRole("switch", { name: "Blog" })).toBeDisabled();
  });
});
