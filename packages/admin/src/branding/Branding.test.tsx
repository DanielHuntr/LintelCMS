import { accentShades } from "@lintel/core/accent-colours";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HelpPage } from "../help/HelpPage.js";
import { Sidebar } from "../layout/Sidebar.js";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { t } from "../i18n/strings.js";
import { accentStyleSheet } from "./applyBranding.js";
import type { Branding, BrandingSettings, PublicBranding } from "./branding.api.js";
import { BrandingPage } from "./BrandingPage.js";
import { currentBranding, showBranding } from "./brandingStore.js";
import { lintelPublicBranding } from "./lintelBranding.js";

const lintelBranding: Branding = {
  productName: lintelPublicBranding.productName,
  logo: null,
  logoDark: null,
  mark: null,
  favicon: null,
  accentColour: lintelPublicBranding.accentColour,
  signInMessage: null,
  signInBackground: null,
  supportUrl: null,
  supportEmail: null,
  docsUrl: null,
  hideBuiltWithLintel: false,
  hideLintelHelp: false,
};

function branded(changes: Partial<Branding>): PublicBranding {
  const branding = { ...lintelBranding, ...changes };
  return { ...branding, accent: accentShades(branding.accentColour), isLintelDefault: false };
}

afterEach(() => {
  vi.restoreAllMocks();
  showBranding(lintelPublicBranding);
});

describe("Settings → Branding", () => {
  function serveBranding() {
    let saved: Branding = lintelBranding;
    const settings = (): BrandingSettings => ({
      branding: saved,
      defaults: lintelBranding,
      defaultsFromDeployment: false,
    });
    return mockApi(({ method, url, body }) => {
      if (url.pathname === "/branding/settings") return settings();
      if (url.pathname === "/branding" && method === "PUT") {
        saved = body as Branding;
        return settings();
      }
      if (url.pathname === "/branding" && method === "DELETE") {
        saved = lintelBranding;
        return settings();
      }
      if (url.pathname === "/branding") return branded(saved);
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
  }

  it("saves a new name and colour, and the whole admin switches to them", async () => {
    const { calls } = serveBranding();
    const user = userEvent.setup();
    renderScreen(<BrandingPage />);

    const name = await screen.findByLabelText("Product name");
    await user.clear(name);
    await user.type(name, "Acme Studio");
    const colour = screen.getByLabelText("Colour code");
    await user.clear(colour);
    await user.type(colour, "#0b1f4d");
    expect(screen.getByText(/easy to read/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save branding" }));

    expect(await screen.findByText(/Everyone sees the new branding/)).toBeInTheDocument();
    expect(calls.find((call) => call.method === "PUT")?.body).toMatchObject({
      productName: "Acme Studio",
      accentColour: "#0b1f4d",
    });
    await waitFor(() => expect(currentBranding().productName).toBe("Acme Studio"));
    expect(t("signIn.title")).toBe("Sign in to Acme Studio");
    expect(document.getElementById("lintel-branding")?.textContent).toContain("#0b1f4d");
  }, 20_000);

  it("warns when text on the colour would be hard to read", async () => {
    serveBranding();
    const user = userEvent.setup();
    renderScreen(<BrandingPage />);

    const colour = await screen.findByLabelText("Colour code");
    await user.clear(colour);
    await user.type(colour, "#808080");
    expect(screen.getByRole("alert")).toHaveTextContent(/hard to read/);
  });

  it("asks before resetting to Lintel's look", async () => {
    const { calls } = serveBranding();
    const user = userEvent.setup();
    renderScreen(<BrandingPage />);

    await user.click(await screen.findByRole("button", { name: "Reset to Lintel defaults" }));
    expect(screen.getByRole("heading", { name: "Reset branding?" })).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Reset to Lintel defaults" });
    await user.click(buttons[buttons.length - 1] as HTMLElement);
    await waitFor(() => expect(calls.some((call) => call.method === "DELETE")).toBe(true));
  });
});

describe("branding across the admin", () => {
  it("shows the agency's logo in the sidebar", async () => {
    showBranding(branded({ productName: "Acme Studio", logo: "https://acme.example/logo.svg" }));
    renderScreen(<Sidebar permissions={["*"]} enabledPlugins={[]} signedInUser={undefined} />);
    expect(await screen.findByRole("img", { name: "Acme Studio" })).toHaveAttribute(
      "src",
      "https://acme.example/logo.svg",
    );
  });

  it("puts the agency's support details on the Help page and can hide Lintel's pages", async () => {
    showBranding(
      branded({
        supportEmail: "help@acme.example",
        hideLintelHelp: true,
        docsUrl: "https://acme.example/guides",
      }),
    );
    renderScreen(<HelpPage topic={undefined} onOpenTopic={() => undefined} />);
    expect(await screen.findByRole("link", { name: "Email help@acme.example" })).toHaveAttribute(
      "href",
      "mailto:help@acme.example",
    );
    expect(screen.getByRole("link", { name: /Open the guides/ })).toHaveAttribute(
      "href",
      "https://acme.example/guides",
    );
    expect(screen.queryByRole("link", { name: /Open the full docs/ })).not.toBeInTheDocument();
  });

  it("names the page and the product in the browser tab", async () => {
    showBranding(branded({ productName: "Acme Studio" }));
    serveBrandingQuietly();
    renderScreen(<BrandingPage />);
    await waitFor(() => expect(document.title).toBe("Branding · Acme Studio"));
  });

  it("writes accent tokens for both colour schemes", () => {
    const css = accentStyleSheet(accentShades("#ffd60a"));
    expect(css).toContain("--color-on-accent: #1d1d1f");
    expect(css).toContain("prefers-color-scheme: dark");
  });
});

function serveBrandingQuietly() {
  mockApi(() => ({
    branding: lintelBranding,
    defaults: lintelBranding,
    defaultsFromDeployment: false,
  }));
}
