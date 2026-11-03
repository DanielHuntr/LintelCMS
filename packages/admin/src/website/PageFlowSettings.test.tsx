import { defaultSiteEffectSettings, type SiteEffectSettings } from "@lintel/motion/effects";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { SiteSettingsPage } from "./SiteSettingsPage.js";
import type { Website } from "./website.api.js";

const website: Website = {
  template: "clean",
  theme: {
    brandColour: "#7539fd",
    accentColour: "#0a84ff",
    fontPairing: "system",
    cornerStyle: "soft",
    spacing: "comfortable",
    colourScheme: "auto",
  },
  logoAssetId: null,
  siteAddress: "",
  effectiveSiteAddress: "http://localhost:3000",
  builtInSiteUrl: "http://localhost:3000",
  templates: [],
  fontPairings: [{ id: "system", name: "Clean", description: "Your device’s own font." }],
};

afterEach(() => vi.restoreAllMocks());

function serve(effects: SiteEffectSettings = defaultSiteEffectSettings) {
  return mockApi(({ method, url, body }) => {
    if (url.pathname === "/website") return website;
    if (url.pathname === "/website/address")
      return { siteAddress: "http://localhost:3000", defaultLocale: "en-GB" };
    if (url.pathname === "/website/effects" && method === "GET") return effects;
    if (url.pathname === "/website/effects" && method === "PUT")
      return { ...effects, ...(body as Partial<SiteEffectSettings>) };
    throw new Error(`Unexpected request: ${method} ${url.pathname}`);
  });
}

async function openSection() {
  renderScreen(<SiteSettingsPage />);
  return within(await screen.findByRole("region", { name: "Moving between pages" }));
}

describe("Moving between pages, in Settings → Your website", () => {
  it("starts calm: two choices, everything off, and nothing more until one is on", async () => {
    serve();
    const section = await openSection();
    expect(section.getByLabelText("When people open another page")).toHaveValue("none");
    expect(section.getByLabelText("Intro on the first visit")).toHaveValue("none");
    expect(section.queryByRole("radiogroup", { name: "Speed" })).not.toBeInTheDocument();
    expect(section.queryByText("Intro words and colours")).not.toBeInTheDocument();
    expect(section.getByText("Pages change straight away, with no intro.")).toBeInTheDocument();
  });

  it("saves a page change, its speed and an intro with the rest of the site's look", async () => {
    const user = userEvent.setup();
    const api = serve();
    const section = await openSection();
    await user.selectOptions(section.getByLabelText("When people open another page"), "slide");
    await user.click(section.getByRole("radio", { name: "Slow" }));
    await user.selectOptions(section.getByLabelText("Intro on the first visit"), "name");
    expect(
      section.getByText(/Shown once per visit, before the home page, for up to three seconds/),
    ).toBeInTheDocument();
    await user.click(section.getByText("Intro words and colours"));
    expect(section.getByLabelText("Words")).toHaveAttribute("placeholder", "Brightside Bakery");
    await user.type(section.getByLabelText("Words"), "Rye");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(api.calls).toContainEqual(
        expect.objectContaining({
          method: "PUT",
          body: {
            pageTransition: { style: "slide", duration: 800 },
            intro: { ...defaultSiteEffectSettings.intro, style: "name", text: "Rye" },
          },
        }),
      ),
    );
    expect(
      await screen.findByText("Saved. Your website shows the changes now."),
    ).toBeInTheDocument();
  });

  it("shows a saved length as the nearest speed", async () => {
    serve({ ...defaultSiteEffectSettings, pageTransition: { style: "wipe", duration: 450 } });
    const section = await openSection();
    expect(section.getByRole("radio", { name: "Steady" })).toBeChecked();
  });

  it("says where the logo comes from when the logo intro is picked without one", async () => {
    const user = userEvent.setup();
    serve();
    const section = await openSection();
    await user.selectOptions(section.getByLabelText("Intro on the first visit"), "logo");
    expect(section.getByText(/Add a logo above to show it here/)).toBeInTheDocument();
  });

  it("leaves the section out when the site's motion settings can't be read", async () => {
    mockApi(({ url }) => {
      if (url.pathname === "/website") return website;
      if (url.pathname === "/website/address") return { siteAddress: null, defaultLocale: "en-GB" };
      throw new Response(null, { status: 403 });
    });
    renderScreen(<SiteSettingsPage />);
    expect(await screen.findByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Moving between pages" })).not.toBeInTheDocument();
  });
});
