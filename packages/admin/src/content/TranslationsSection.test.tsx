import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { Entry } from "./content.types.js";
import { TranslationsSection } from "./TranslationsSection.js";

const page = { id: "team", translations: [] } as unknown as Entry;

beforeAll(() => {
  // jsdom has no modal dialogs.
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.open = false;
  };
});

describe("translating a page", () => {
  it("offers to translate the pages above it first (LINTEL-FUNC-037)", async () => {
    const { calls } = mockApi(({ method, url, body }) => {
      if (url.pathname === "/locales") {
        return {
          defaultLocale: "en-GB",
          locales: [
            { code: "en-GB", name: "British English" },
            { code: "fr-FR", name: "French (France)" },
          ],
        };
      }
      if (method === "POST" && url.pathname === "/entries/team/translations") {
        if ((body as { withParents?: boolean }).withParents) return { id: "team-fr" };
        throw new Response(
          JSON.stringify({
            statusCode: 409,
            code: "PARENTS_NOT_TRANSLATED",
            message: "Translate them first.",
            missingParents: [{ id: "home", title: "Home" }],
          }),
          { status: 409 },
        );
      }
      return undefined;
    });
    renderScreen(<TranslationsSection collectionHandle="pages" entry={page} locale="en-GB" />, {
      permissions: ["*"],
    });

    await userEvent.click(
      await screen.findByRole("button", { name: "Translate into French (France)" }),
    );
    expect(await screen.findByText(/Home comes first/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Translate them too" }));

    await waitFor(() =>
      expect(calls.at(-1)?.body).toMatchObject({ locale: "fr-FR", withParents: true }),
    );
  });
});
