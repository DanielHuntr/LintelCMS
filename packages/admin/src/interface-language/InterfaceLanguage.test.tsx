import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { switchInterfaceLanguage } from "../i18n/activeLanguage.js";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { InterfaceLanguageChoice } from "./interfaceLanguage.api.js";
import { InterfaceLanguagePage } from "./InterfaceLanguagePage.js";

afterEach(async () => {
  vi.restoreAllMocks();
  await switchInterfaceLanguage("en");
});

function serveLanguages(initial: InterfaceLanguageChoice) {
  let choice = initial;
  return mockApi(({ method, url, body }) => {
    const { language } = (body ?? {}) as { language: string | null };
    if (url.pathname === "/interface-language" && method === "PUT") {
      choice = { ...choice, personal: language, active: language ?? choice.siteDefault };
    }
    if (url.pathname === "/interface-language/site-default") {
      choice = {
        ...choice,
        siteDefault: language ?? "en",
        active: choice.personal ?? language ?? "en",
      };
    }
    return choice;
  });
}

describe("Account → Interface language", () => {
  it("switches the admin to the language someone picks", async () => {
    const { calls } = serveLanguages({ personal: null, siteDefault: "en", active: "en" });
    const user = userEvent.setup();
    renderScreen(<InterfaceLanguagePage />);

    await user.selectOptions(await screen.findByLabelText("Your language"), "ar-XB");

    await waitFor(() => expect(document.documentElement.dir).toBe("rtl"));
    expect(calls.find((call) => call.method === "PUT")?.body).toEqual({ language: "ar-XB" });
  });

  it("lets people who manage settings choose the site's default", async () => {
    const { calls } = serveLanguages({ personal: null, siteDefault: "en", active: "en" });
    const user = userEvent.setup();
    renderScreen(<InterfaceLanguagePage />);

    await user.selectOptions(await screen.findByLabelText("Site default"), "en-XA");
    await waitFor(() =>
      expect(calls.some((call) => call.url.pathname === "/interface-language/site-default")).toBe(
        true,
      ),
    );
  });

  it("hides the site default from people who can't change settings", async () => {
    serveLanguages({ personal: null, siteDefault: "en", active: "en" });
    renderScreen(<InterfaceLanguagePage />, { permissions: ["entries:read"] });
    expect(await screen.findByLabelText("Your language")).toBeInTheDocument();
    expect(screen.queryByLabelText("Site default")).not.toBeInTheDocument();
  });
});
