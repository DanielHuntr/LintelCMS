import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Plugin } from "./setup.api.js";
import { SiteStep } from "./SiteStep.js";

const plugins: Plugin[] = [
  { id: "blog", name: "Blog", description: "Posts, categories and an archive.", enabled: false },
  { id: "commerce", name: "Commerce", description: "Products, cart and checkout.", enabled: false },
  { id: "forms", name: "Forms", description: "Contact forms and sign-ups.", enabled: false },
  { id: "seo", name: "SEO", description: "Titles, descriptions and sitemaps.", enabled: false },
];

function renderStep(saveSiteSetup = vi.fn().mockResolvedValue(undefined)) {
  const onFinished = vi.fn();
  render(
    <SiteStep
      plugins={plugins}
      api={{ saveSiteSetup }}
      setupCode={undefined}
      stepNumber={{ current: 3, total: 3 }}
      onFinished={onFinished}
    />,
  );
  return { saveSiteSetup, onFinished };
}

function pluginSwitch(name: string) {
  return screen.getByRole("switch", { name });
}

function switchedOn() {
  return plugins
    .filter(({ name }) => pluginSwitch(name).getAttribute("aria-checked") === "true")
    .map(({ id }) => id);
}

describe("SiteStep", () => {
  it("offers five kinds of site as a radio group", () => {
    renderStep();

    const group = screen.getByRole("radiogroup", { name: "What are you building?" });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("radio", { name: "Business website" })).toBeChecked();
  });

  it("switches on each kind of site's plugins", async () => {
    renderStep();
    expect(switchedOn()).toEqual(["forms", "seo"]);

    await userEvent.click(screen.getByRole("radio", { name: "Online shop" }));
    expect(switchedOn()).toEqual(["commerce", "forms", "seo"]);

    await userEvent.click(screen.getByRole("radio", { name: "Blog" }));
    expect(switchedOn()).toEqual(["blog", "seo"]);

    await userEvent.click(screen.getByRole("radio", { name: "Start from scratch" }));
    expect(switchedOn()).toEqual([]);
  });

  it("sends the plugins as the toggles show them", async () => {
    const { saveSiteSetup, onFinished } = renderStep();
    await userEvent.click(screen.getByRole("radio", { name: "Blog" }));
    await userEvent.click(pluginSwitch("SEO"));
    await userEvent.click(pluginSwitch("Forms"));

    await userEvent.click(screen.getByRole("button", { name: "Finish setup" }));

    expect(saveSiteSetup).toHaveBeenCalledWith("blog", ["blog", "forms"], undefined);
    expect(onFinished).toHaveBeenCalled();
  });

  it("saves a blank site with no plugins when skipped", async () => {
    const { saveSiteSetup } = renderStep();

    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(saveSiteSetup).toHaveBeenCalledWith("blank", [], undefined);
  });

  it("says the features can be changed later", () => {
    renderStep();
    expect(screen.getByText("You can change these any time in Settings.")).toBeInTheDocument();
  });

  it("explains when the server can't be reached", async () => {
    renderStep(vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await userEvent.click(screen.getByRole("button", { name: "Finish setup" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/pnpm dev/);
  });
});
