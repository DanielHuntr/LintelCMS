import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { SiteSettingsPage } from "./SiteSettingsPage.js";
import { ViewPageLink } from "./ViewPageLink.js";
import type { SiteTheme, Website } from "./website.api.js";

const cleanTheme: SiteTheme = {
  brandColour: "#7539fd",
  accentColour: "#0a84ff",
  fontPairing: "system",
  cornerStyle: "soft",
  spacing: "comfortable",
  colourScheme: "auto",
};

const journalTheme: SiteTheme = {
  ...cleanTheme,
  brandColour: "#b4441f",
  fontPairing: "editorial",
  cornerStyle: "square",
};

const website: Website = {
  template: "clean",
  theme: cleanTheme,
  logoAssetId: null,
  siteAddress: "",
  effectiveSiteAddress: "http://localhost:3000",
  builtInSiteUrl: "http://localhost:3000",
  templates: [
    { id: "clean", name: "Clean", description: "A crisp business site.", defaultTheme: cleanTheme },
    {
      id: "journal",
      name: "Journal",
      description: "A reading-first blog.",
      defaultTheme: journalTheme,
    },
  ],
  fontPairings: [
    { id: "system", name: "Clean", description: "Your device’s own font." },
    { id: "editorial", name: "Editorial", description: "Serif throughout." },
  ],
};

afterEach(() => vi.restoreAllMocks());

describe("Settings, Your website", () => {
  function serve() {
    return mockApi(({ method, url, body }) => {
      if (url.pathname === "/website" && method === "GET") return website;
      if (url.pathname === "/website" && method === "PUT") {
        return {
          ...website,
          template: "journal",
          theme: { ...journalTheme, brandColour: "#ff2d55" },
        };
      }
      if (url.pathname === "/website/address")
        return { siteAddress: "http://localhost:3000", defaultLocale: "en-GB" };
      throw new Error(`Unexpected request: ${method} ${url.pathname} ${JSON.stringify(body)}`);
    });
  }

  it("shows where the site is live, with a link to open it", async () => {
    serve();
    renderScreen(<SiteSettingsPage />);
    expect(await screen.findByText("Your website is live")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open website/ })).toHaveAttribute(
      "href",
      "http://localhost:3000",
    );
    expect(screen.getByLabelText("Website address")).toHaveAttribute(
      "placeholder",
      "http://localhost:3000",
    );
  });

  it("picks a template, which brings its own look, then saves a brand colour", async () => {
    const { calls } = serve();
    renderScreen(<SiteSettingsPage />);
    await userEvent.click(await screen.findByRole("radio", { name: /Journal/ }));
    expect(screen.getByRole("radio", { name: /Editorial/ })).toBeChecked();

    const brand = screen.getByLabelText("Brand colour");
    await userEvent.clear(brand);
    await userEvent.type(brand, "#FF2D55");
    await userEvent.click(screen.getByRole("radio", { name: "Dark" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(calls.find((call) => call.method === "PUT")?.body).toEqual({
        template: "journal",
        ...journalTheme,
        brandColour: "#ff2d55",
        colourScheme: "dark",
        logoAssetId: null,
        siteAddress: "",
      }),
    );
    expect(
      await screen.findByText("Saved. Your website shows the changes now."),
    ).toBeInTheDocument();
  });

  it("is read-only without permission to change settings", async () => {
    serve();
    renderScreen(<SiteSettingsPage />, { permissions: ["settings:read"] });
    expect(await screen.findByLabelText("Brand colour")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });
});

describe("View page", () => {
  it("opens the live page on the website", async () => {
    mockApi(() => ({ siteAddress: "http://localhost:3000", defaultLocale: "en-GB" }));
    renderScreen(
      <ViewPageLink
        routePattern="/blog/{slug}"
        entry={{ slug: "sourdough", publishedAt: "2026-03-01T09:00:00Z", locale: "en-GB" }}
      />,
    );
    expect(await screen.findByRole("link", { name: /View page/ })).toHaveAttribute(
      "href",
      "http://localhost:3000/blog/sourdough",
    );
  });
});
