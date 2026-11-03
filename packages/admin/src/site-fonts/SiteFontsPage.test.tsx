import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeAsset } from "../media/media.test-helpers.js";
import type * as MediaApi from "../media/media.api.js";
import { uploadAsset } from "../media/media.api.js";
import { apiErrorResponse, mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { SiteFonts } from "./siteFonts.api.js";
import { SiteFontsPage } from "./SiteFontsPage.js";

vi.mock("../media/media.api.js", async (importOriginal) => ({
  ...(await importOriginal<typeof MediaApi>()),
  uploadAsset: vi.fn(),
}));

const uploadMock = vi.mocked(uploadAsset);

const none: SiteFonts = { fonts: [], adobeProjects: [] };

const withFonts: SiteFonts = {
  fonts: [
    {
      id: "f1",
      family: "Lora",
      category: "serif",
      source: "google",
      sourceId: "lora",
      files: [
        {
          assetId: "a1",
          url: "http://localhost:4000/media/a1/file",
          weight: "400",
          style: "normal",
          format: "woff2",
        },
      ],
      weights: ["400", "700"],
      hasItalic: true,
    },
    {
      id: "f2",
      family: "proxima-nova",
      category: "sans",
      source: "adobe",
      sourceId: "abc1def",
      files: [],
      weights: [],
      hasItalic: false,
    },
  ],
  adobeProjects: [
    {
      projectId: "abc1def",
      stylesheetUrl: "https://use.typekit.net/abc1def.css",
      families: ["proxima-nova"],
    },
  ],
};

const roboto = {
  id: "roboto",
  family: "Roboto",
  category: "sans",
  weights: ["100", "400", "700"],
  hasItalic: true,
};

afterEach(() => vi.restoreAllMocks());

describe("Settings, Site, Fonts", () => {
  it("starts with a guided empty state", async () => {
    mockApi(({ url }) => (url.pathname === "/site-fonts" ? none : {}));
    renderScreen(<SiteFontsPage />);
    expect(await screen.findByText("No fonts of your own yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a font" })).toBeInTheDocument();
    expect(screen.getByText(/Lintel also includes 23 fonts/)).toBeInTheDocument();
  });

  it("lists the site's fonts and Adobe projects, and removes one after asking", async () => {
    const api = mockApi(({ url, method }) => {
      if (url.pathname === "/site-fonts" && method === "GET") return withFonts;
      return undefined;
    });
    renderScreen(<SiteFontsPage />);

    const list = await screen.findByRole("list", { name: "This site’s fonts" });
    expect(within(list).getByText("Lora")).toBeInTheDocument();
    expect(
      within(list).getByText("Google Fonts · Regular, Bold, with italics"),
    ).toBeInTheDocument();
    expect(screen.getByText("Adobe Fonts project abc1def")).toBeInTheDocument();
    expect(
      screen.getByText(/Add your website’s address to the project in Adobe Fonts/),
    ).toBeInTheDocument();

    await userEvent.click(within(list).getByRole("button", { name: "Remove Lora" }));
    await userEvent.click(await screen.findByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(
        api.calls.some(
          (call) => call.method === "DELETE" && call.url.pathname === "/site-fonts/f1",
        ),
      ).toBe(true),
    );
  });

  it("is read-only for people who can't change settings", async () => {
    mockApi(({ url }) => (url.pathname === "/site-fonts" ? withFonts : {}));
    renderScreen(<SiteFontsPage />, { permissions: ["entries:read", "settings:read"] });
    expect(await screen.findByText("Lora")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a font" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Lora" })).not.toBeInTheDocument();
  });

  describe("adding a font", () => {
    async function openDialog() {
      renderScreen(<SiteFontsPage />);
      await userEvent.click(await screen.findByRole("button", { name: "Add a font" }));
      return screen.findByRole("dialog", { name: "Add a font" });
    }

    it("searches Google Fonts, then adds the chosen weights", async () => {
      const api = mockApi(({ url, method }) => {
        if (url.pathname === "/site-fonts" && method === "GET") return none;
        if (url.pathname === "/site-fonts/google" && method === "GET")
          return { fonts: [roboto], total: 1 };
        if (url.pathname === "/site-fonts/google" && method === "POST") return withFonts.fonts[0];
        return {};
      });
      const dialog = await openDialog();

      await userEvent.type(within(dialog).getByLabelText("Search Google Fonts"), "robo");
      await waitFor(() =>
        expect(api.calls.some((call) => call.url.searchParams.get("search") === "robo")).toBe(true),
      );
      await userEvent.click(await within(dialog).findByRole("button", { name: /Roboto/ }));
      expect(within(dialog).getByRole("checkbox", { name: "Regular" })).toBeChecked();
      expect(within(dialog).getByRole("checkbox", { name: "Bold" })).toBeChecked();
      expect(within(dialog).getByRole("checkbox", { name: "Thin" })).not.toBeChecked();
      expect(within(dialog).getByText(/never contact Google/)).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole("checkbox", { name: "Italics too" }));
      await userEvent.click(within(dialog).getByRole("button", { name: "Add Roboto" }));

      await waitFor(() =>
        expect(api.calls.find((call) => call.method === "POST")?.body).toEqual({
          id: "roboto",
          weights: ["400", "700"],
          italic: true,
        }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("explains plainly when Google Fonts can't be reached", async () => {
      mockApi(({ url }) => {
        if (url.pathname === "/site-fonts") return none;
        throw apiErrorResponse(
          503,
          "FONT_SERVICE_UNREACHABLE",
          "Lintel couldn't reach Google Fonts just now. Check this server is online and try again. The fonts that come with Lintel still work.",
        );
      });
      const dialog = await openDialog();
      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "couldn't reach Google Fonts",
      );
    });

    it("uploads several files, reads their names, and needs the licence ticked", async () => {
      uploadMock
        .mockResolvedValueOnce(makeAsset({ id: "u1", filename: "Studio-Regular.woff2" }))
        .mockResolvedValueOnce(makeAsset({ id: "u2", filename: "Studio-BoldItalic.woff2" }));
      const api = mockApi(({ url, method }) => {
        if (url.pathname === "/site-fonts" && method === "GET") return none;
        if (url.pathname === "/site-fonts/inspect")
          return {
            files: [
              {
                assetId: "u1",
                filename: "Studio-Regular.woff2",
                family: "Studio Sans",
                weight: "400",
                style: "normal",
                readFromFile: true,
              },
              {
                assetId: "u2",
                filename: "Studio-BoldItalic.woff2",
                family: "Studio",
                weight: "700",
                style: "italic",
                readFromFile: false,
              },
            ],
          };
        if (url.pathname === "/site-fonts/uploaded")
          return { ...withFonts.fonts[0], family: "Studio Sans" };
        return { fonts: [], total: 0 };
      });
      const dialog = await openDialog();
      await userEvent.click(within(dialog).getByRole("radio", { name: "Your files" }));
      await userEvent.upload(within(dialog).getByLabelText(/Choose font files/), [
        new File(["a"], "Studio-Regular.woff2", { type: "font/woff2" }),
        new File(["b"], "Studio-BoldItalic.woff2", { type: "font/woff2" }),
      ]);

      expect(await within(dialog).findByLabelText("Font name")).toHaveValue("Studio Sans");
      expect(within(dialog).getByText("Guessed from the file name")).toBeInTheDocument();
      expect(within(dialog).getByLabelText("Weight of Studio-BoldItalic.woff2")).toHaveValue("700");
      const add = within(dialog).getByRole("button", { name: "Add font" });
      expect(add).toBeDisabled();
      await userEvent.selectOptions(within(dialog).getByLabelText("Kind"), "serif");
      await userEvent.click(
        within(dialog).getByRole("checkbox", { name: /My licence lets me use this font/ }),
      );
      await userEvent.click(add);

      await waitFor(() =>
        expect(
          api.calls.find((call) => call.url.pathname === "/site-fonts/uploaded")?.body,
        ).toEqual({
          family: "Studio Sans",
          category: "serif",
          licenceConfirmed: true,
          files: [
            { assetId: "u1", weight: "400", style: "normal" },
            { assetId: "u2", weight: "700", style: "italic" },
          ],
        }),
      );
    });

    it("connects an Adobe Fonts project, and shows Adobe's answer when it's wrong", async () => {
      const api = mockApi(({ url, method }) => {
        if (url.pathname === "/site-fonts" && method === "GET") return none;
        if (url.pathname === "/site-fonts/google") return { fonts: [], total: 0 };
        if (url.pathname === "/site-fonts/adobe") {
          const body = (api.calls.at(-1)?.body ?? {}) as { projectId?: string };
          if (body.projectId === "nope123")
            throw apiErrorResponse(
              404,
              "ADOBE_PROJECT_NOT_FOUND",
              "Adobe Fonts doesn't know that project ID.",
            );
          return withFonts;
        }
        return {};
      });
      const dialog = await openDialog();
      await userEvent.click(within(dialog).getByRole("radio", { name: "Adobe Fonts" }));
      expect(within(dialog).getByText(/Adobe serves these fonts/)).toBeInTheDocument();
      const field = within(dialog).getByLabelText("Web project ID");
      await userEvent.type(field, "nope123");
      await userEvent.click(within(dialog).getByRole("button", { name: "Connect" }));
      expect(
        await within(dialog).findByText("Adobe Fonts doesn't know that project ID."),
      ).toBeInTheDocument();

      await userEvent.clear(field);
      await userEvent.type(field, "abc1def");
      await userEvent.click(within(dialog).getByRole("button", { name: "Connect" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });
  });
});
