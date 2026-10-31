import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client.js";
import type { Session } from "../session/session.api.js";
import type { Plugin } from "./setup.api.js";
import { SiteWizard, summaryOf } from "./SiteWizard.js";
import { setupStatus } from "./testStatus.js";

// The API's own names and descriptions: the screen must show these, not its own.
const plugins: Plugin[] = [
  { id: "blog", name: "Blog", description: "Posts, categories and an archive.", enabled: false },
  { id: "commerce", name: "Online shop", description: "Products and checkout.", enabled: false },
  { id: "forms", name: "Forms", description: "Contact forms and sign-ups.", enabled: false },
  {
    id: "seo",
    name: "SEO tools",
    description: "Titles, descriptions and a sitemap.",
    enabled: false,
  },
];

const session: Session = {
  user: { id: "user-1", email: "daniel@gmail.com", name: "Daniel Roberts" },
  permissions: ["*"],
  enabledPlugins: [],
};

function renderWizard(saveSiteSetup = vi.fn().mockResolvedValue(undefined)) {
  const onGoToDashboard = vi.fn();
  render(
    <SiteWizard
      status={setupStatus({ needsSetup: false })}
      session={session}
      plugins={plugins}
      api={{ saveSiteSetup }}
      setupCode={undefined}
      onGoToDashboard={onGoToDashboard}
    />,
  );
  return { saveSiteSetup, onGoToDashboard };
}

function switchedOn() {
  return plugins
    .filter(
      ({ name }) => screen.getByRole("switch", { name }).getAttribute("aria-checked") === "true",
    )
    .map(({ id }) => id);
}

/** Picks a kind of site; the screen moves on to the features by itself. */
async function build(siteTitle: string) {
  await userEvent.click(screen.getByRole("radio", { name: siteTitle }));
  await screen.findByRole("heading", { name: "Choose your features" });
}

describe("SiteWizard", () => {
  it("offers five kinds of site as a radio group, business chosen", () => {
    renderWizard();

    expect(screen.getByRole("radiogroup", { name: "What are you building?" })).toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("radio", { name: "Business website" })).toBeChecked();
  });

  it.each([
    ["Business website", ["forms", "seo"]],
    ["Blog", ["blog", "seo"]],
    ["Online shop", ["commerce", "forms", "seo"]],
    ["Portfolio", ["forms", "seo"]],
    ["Start from scratch", []],
  ])("switches on the right features for %s", async (siteTitle, expected) => {
    renderWizard();

    await build(siteTitle);

    expect(switchedOn()).toEqual(expected);
  });

  it("only moves on from the tiles when one is picked, not while arrowing through them", async () => {
    renderWizard();
    await userEvent.tab();

    await userEvent.keyboard("{ArrowRight}");

    expect(screen.getByRole("radio", { name: "Blog" })).toBeChecked();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("What are you building?");

    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { name: "Choose your features" })).toBeVisible();
  });

  it("sends the features as the toggles show them, then says it's done", async () => {
    const { saveSiteSetup } = renderWizard();
    await build("Blog");
    await userEvent.click(screen.getByRole("switch", { name: "SEO tools" }));
    await userEvent.click(screen.getByRole("switch", { name: "Forms" }));

    await userEvent.click(screen.getByRole("button", { name: "Finish setup" }));

    expect(saveSiteSetup).toHaveBeenCalledWith("blog", ["blog", "forms"], undefined);
    expect(await screen.findByRole("heading", { name: "You’re all set, Daniel" })).toBeVisible();
    expect(screen.getByText("Built-in database · Blog, Forms")).toBeVisible();
  });

  it("goes back to the kinds of site from the features", async () => {
    renderWizard();
    await build("Online shop");

    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByRole("radio", { name: "Online shop" })).toBeChecked();
  });

  it("saves a blank site with no features when skipped", async () => {
    const { saveSiteSetup } = renderWizard();
    await build("Blog");

    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(saveSiteSetup).toHaveBeenCalledWith("blank", [], undefined);
    expect(await screen.findByText("Built-in database · No extra features")).toBeVisible();
  });

  it("goes to the dashboard from the last screen", async () => {
    const { onGoToDashboard } = renderWizard();
    await build("Blog");
    await userEvent.click(screen.getByRole("button", { name: "Finish setup" }));

    await userEvent.click(await screen.findByRole("button", { name: "Go to your dashboard" }));

    expect(onGoToDashboard).toHaveBeenCalled();
  });

  it("shows problems calmly and stays on the features", async () => {
    renderWizard(
      vi
        .fn()
        .mockRejectedValue(
          new ApiError(429, "TOO_MANY_SETUP_ATTEMPTS", "Too many tries. Wait a minute."),
        ),
    );
    await build("Blog");

    await userEvent.click(screen.getByRole("button", { name: "Finish setup" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Too many tries. Wait a minute.");
    expect(screen.getByRole("button", { name: "Finish setup" })).toBeEnabled();
  });
});

describe("summaryOf", () => {
  it("names the database and the features switched on", () => {
    const postgres = setupStatus({ database: { kind: "postgres", chosenBy: "setup" } });
    expect(summaryOf(postgres, plugins, ["commerce", "seo"])).toBe(
      "PostgreSQL database · Online shop, SEO tools",
    );
  });
});
