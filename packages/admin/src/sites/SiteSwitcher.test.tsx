import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { currentSiteHandle, rememberCurrentSite, siteHeaders } from "./currentSite.js";
import { CurrentSiteProvider } from "./SiteContext.js";
import { SiteSwitcher } from "./SiteSwitcher.js";
import type { Site } from "./sites.types.js";

afterEach(() => {
  vi.restoreAllMocks();
  rememberCurrentSite(undefined);
});

function makeSite(overrides: Partial<Site>): Site {
  return {
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    handle: "default",
    name: "Acme UK",
    isDefault: true,
    hostnames: [],
    pathPrefix: "",
    siteUrl: "",
    defaultLocale: "en-GB",
    locales: [{ code: "en-GB", name: "English (United Kingdom)" }],
    branding: { logoAssetId: null, accentColor: null },
    entryCount: 0,
    ...overrides,
  };
}

const uk = makeSite({});
const france = makeSite({
  id: "aaaaaaaa-0000-4000-8000-000000000002",
  handle: "france",
  name: "Acme France",
  isDefault: false,
  defaultLocale: "fr-FR",
});

function renderSwitcher(sites: Site[]) {
  mockApi(() => ({ sites }));
  return renderScreen(
    <CurrentSiteProvider initialSites={sites}>
      <SiteSwitcher />
    </CurrentSiteProvider>,
  );
}

describe("SiteSwitcher", () => {
  it("stays out of the way while there is only one site", async () => {
    renderSwitcher([uk]);

    await waitFor(() => expect(currentSiteHandle()).toBe("default"));
    expect(screen.queryByLabelText("Working on")).not.toBeInTheDocument();
  });

  it("switches the site every request is for, and remembers it", async () => {
    renderSwitcher([uk, france]);

    const select = await screen.findByLabelText("Working on");
    expect(select).toHaveValue("default");

    await userEvent.selectOptions(select, "Acme France");

    expect(select).toHaveValue("france");
    expect(siteHeaders()).toEqual({ "lintel-site": "france" });
    expect(localStorage.getItem("lintel.currentSite")).toBe("france");
  });

  it("falls back to the main site when the remembered one has gone", async () => {
    rememberCurrentSite("closed-down");
    renderSwitcher([uk, france]);

    expect(await screen.findByLabelText("Working on")).toHaveValue("default");
    await waitFor(() => expect(currentSiteHandle()).toBe("default"));
  });
});
