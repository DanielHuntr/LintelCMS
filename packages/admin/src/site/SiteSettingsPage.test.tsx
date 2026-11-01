import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiErrorResponse, mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { SiteSettingsPage } from "./SiteSettingsPage.js";

afterEach(() => vi.restoreAllMocks());

describe("Settings → Site", () => {
  it("saves the website's address as the API tidies it", async () => {
    const { calls } = mockApi(({ method, body }) => {
      if (method === "PUT") return { siteAddress: "https://brightsidebakery.com" };
      return body ?? { siteAddress: "" };
    });
    renderScreen(<SiteSettingsPage />);

    const address = await screen.findByLabelText("Your website’s address");
    await userEvent.type(address, "https://brightsidebakery.com/home");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(address).toHaveValue("https://brightsidebakery.com");
    expect(calls.find((call) => call.method === "PUT")?.body).toEqual({
      siteAddress: "https://brightsidebakery.com/home",
    });
  });

  it("explains an address the API refuses", async () => {
    mockApi(({ method }) => {
      if (method === "PUT") {
        throw apiErrorResponse(
          400,
          "INVALID_FIELDS",
          "The site address should start with https://",
        );
      }
      return { siteAddress: "" };
    });
    renderScreen(<SiteSettingsPage />);

    await userEvent.type(await screen.findByLabelText("Your website’s address"), "bakery");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/should start with https:\/\//)).toBeInTheDocument();
  });

  it("is read-only without permission to change settings", async () => {
    mockApi(() => ({ siteAddress: "https://brightsidebakery.com" }));
    renderScreen(<SiteSettingsPage />, { permissions: ["settings:read"] });

    expect(await screen.findByLabelText("Your website’s address")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });
});
