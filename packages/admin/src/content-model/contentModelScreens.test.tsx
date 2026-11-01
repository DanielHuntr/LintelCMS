import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TranslationsSection } from "../content/TranslationsSection.js";
import { samplePost } from "../content/testEntries.js";
import { GlobalSetPage } from "../globals/GlobalSetPage.js";
import type { GlobalSet } from "../globals/globals.types.js";
import { LanguagesPage } from "../locales/LanguagesPage.js";
import { TaxonomyPage } from "../taxonomies/TaxonomyPage.js";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";

const twoLanguages = {
  defaultLocale: "en-GB",
  locales: [
    { code: "en-GB", name: "British English", isDefault: true, entryCount: 3 },
    { code: "fr-FR", name: "French (France)", isDefault: false, entryCount: 0 },
  ],
};

afterEach(() => vi.restoreAllMocks());

describe("LanguagesPage", () => {
  it("adds a language picked from the list", async () => {
    const api = mockApi(({ method, url }) => {
      if (method === "POST")
        return { code: "de-DE", name: "German (Germany)", isDefault: false, entryCount: 0 };
      if (url.pathname === "/locales") return twoLanguages;
      return undefined;
    });
    renderScreen(<LanguagesPage />);

    expect(await screen.findByText("British English")).toBeInTheDocument();
    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove British English" }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add language" }));
    const sheet = await screen.findByRole("dialog", { name: "Add a language" });
    const choice = within(sheet).getByRole("combobox", { name: "Language" });
    expect(
      within(choice).queryByRole("option", { name: "French (France)" }),
    ).not.toBeInTheDocument();
    await userEvent.selectOptions(choice, "de-DE");
    await userEvent.click(within(sheet).getByRole("button", { name: "Add language" }));

    await waitFor(() =>
      expect(api.calls.find(({ method }) => method === "POST")?.body).toEqual({ code: "de-DE" }),
    );
  });
});

describe("TaxonomyPage", () => {
  it("adds a term with a slug made from its name", async () => {
    const api = mockApi(({ method, url }) => {
      if (method === "POST") return { id: "t9", title: "Recipes", slug: "recipes" };
      if (url.pathname === "/taxonomies/tags") {
        return { id: "x1", handle: "tags", name: "Tags", termCount: 0, updatedAt: "" };
      }
      return { terms: [] };
    });
    renderScreen(<TaxonomyPage handle="tags" />);

    expect(await screen.findByText("No terms in Tags yet")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add term" }));
    const sheet = await screen.findByRole("dialog", { name: "New term" });
    await userEvent.type(within(sheet).getByRole("textbox", { name: "Name" }), "Recipes & tips");
    expect(within(sheet).getByRole("textbox", { name: "Slug" })).toHaveAttribute(
      "placeholder",
      "recipes-and-tips",
    );
    await userEvent.click(within(sheet).getByRole("button", { name: "Add term" }));

    await waitFor(() =>
      expect(api.calls.find(({ method }) => method === "POST")).toMatchObject({
        url: expect.objectContaining({ pathname: "/taxonomies/tags/terms" }),
        body: { title: "Recipes & tips", description: "" },
      }),
    );
  });
});

describe("GlobalSetPage", () => {
  const siteSettings: GlobalSet = {
    id: "g1",
    handle: "site_settings",
    name: "Site settings",
    fieldCount: 1,
    updatedAt: "",
    fields: [
      {
        handle: "footer_text",
        label: "Footer text",
        type: "textarea",
        required: false,
        options: {},
      },
    ],
    locale: "fr-FR",
    data: { footer_text: "Open daily" },
    hasOwnValues: false,
  };

  it("says when a language shows the main language's values, and saves its own", async () => {
    const api = mockApi(({ method, url }) => {
      if (url.pathname === "/locales") return twoLanguages;
      if (method === "PATCH")
        return { ...siteSettings, data: { footer_text: "Ouvert" }, hasOwnValues: true };
      return siteSettings;
    });
    renderScreen(<GlobalSetPage handle="site_settings" />);

    expect(
      await screen.findByText(/There’s nothing saved in French \(France\) yet/),
    ).toBeInTheDocument();
    const footer = screen.getByRole("textbox", { name: "Footer text" });
    await userEvent.clear(footer);
    await userEvent.type(footer, "Ouvert");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.queryByText(/nothing saved in French/)).not.toBeInTheDocument(),
    );
    const patch = api.calls.find(({ method }) => method === "PATCH");
    expect(patch?.url.pathname).toBe("/globals/site_settings/values");
    expect(patch?.body).toEqual({ data: { footer_text: "Ouvert" } });
  });
});

describe("TranslationsSection", () => {
  it("offers to translate into the other languages, and starts a translation", async () => {
    const api = mockApi(({ method, url }) => {
      if (url.pathname === "/locales") return twoLanguages;
      if (method === "POST") return samplePost({ id: "p2", locale: "fr-FR", originId: "p1" });
      return undefined;
    });
    const { router } = renderScreen(
      <TranslationsSection collectionHandle="posts" entry={samplePost()} locale="en-GB" />,
    );

    expect(await screen.findByText("Written in British English")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Translate into French (France)" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/content/posts/p2"));
    expect(api.calls.find(({ method }) => method === "POST")?.body).toEqual({ locale: "fr-FR" });
  });

  it("links to translations that exist, and hides itself on one-language sites", async () => {
    mockApi(() => twoLanguages);
    renderScreen(
      <TranslationsSection
        collectionHandle="posts"
        entry={samplePost({
          translations: [{ id: "p2", locale: "fr-FR", title: "Bonjour", status: "draft" }],
        })}
        locale="en-GB"
      />,
    );

    expect(
      await screen.findByRole("link", { name: /^French \(France\),\s?Draft$/ }),
    ).toHaveAttribute("href", "/content/posts/p2");
  });
});
