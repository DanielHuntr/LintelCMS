import { createEmptyPage } from "@lintel/builder-model";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Entry } from "../content/content.types.js";
import { samplePost } from "../content/testEntries.js";
import { apiErrorResponse, mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { PageDesignPage } from "./PageDesignPage.js";
import { PageFieldEditor } from "./PageFieldEditor.js";

function samplePage(design: unknown = null): Entry {
  const post = samplePost();
  return samplePost({
    data: { title: "Home", design },
    blueprint: {
      ...post.blueprint,
      fields: [
        { handle: "title", label: "Title", type: "text", required: true, options: {} },
        { handle: "design", label: "Design", type: "page", required: false, options: {} },
      ],
    },
  });
}

afterEach(() => vi.restoreAllMocks());

describe("a page design field", () => {
  const props = {
    field: {
      handle: "design",
      label: "Design",
      type: "page" as const,
      required: false,
      options: {},
    },
    onChange: () => undefined,
    controlId: "design",
    labelId: "design-label",
    describedBy: undefined,
    hasError: false,
    innerErrors: {},
    renderField: () => null,
  };

  it("asks for the entry to be saved before it can be designed", async () => {
    renderScreen(<PageFieldEditor {...props} value={createEmptyPage()} />);
    expect(await screen.findByText(/Give the entry a title first/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit design" })).not.toBeInTheDocument();
  });
});

describe("the page design screen", () => {
  it("opens an empty page at the start screen and saves what is added", async () => {
    const user = userEvent.setup();
    const { calls } = mockApi(({ method, url, body }) => {
      if (method === "GET" && url.pathname === "/entries/p1") return samplePage();
      if (method === "PATCH" && url.pathname === "/entries/p1") {
        return samplePage((body as { data: { design: unknown } }).data.design);
      }
      throw apiErrorResponse(404, "NOT_FOUND", "Not found");
    });
    renderScreen(<PageDesignPage collectionHandle="pages" entryId="p1" fieldHandle="design" />);
    await user.click(await screen.findByRole("button", { name: /Call to action/ }));
    await waitFor(() => expect(calls.some((call) => call.method === "PATCH")).toBe(true), {
      timeout: 4000,
    });
    const saved = calls.find((call) => call.method === "PATCH")?.body as {
      data: { design: { root: { children: Array<{ name: string }> } } };
    };
    expect(saved.data.design.root.children[0]?.name).toBe("Call to action");
    expect((await screen.findAllByText("Saved")).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Home" })).toBeInTheDocument();
  });

  it("shows the server’s message when it refuses a design", async () => {
    const user = userEvent.setup();
    mockApi(({ method }) => {
      if (method === "GET") return samplePage();
      throw apiErrorResponse(400, "INVALID_FIELDS", "Some fields need attention", {
        design: "Design: only people allowed to edit code can add or change code.",
      });
    });
    renderScreen(<PageDesignPage collectionHandle="pages" entryId="p1" fieldHandle="design" />, {
      permissions: ["entries:*"],
    });
    await user.click(await screen.findByRole("button", { name: /Hero/ }));
    expect(await screen.findByRole("alert", {}, { timeout: 4000 })).toHaveTextContent(
      "only people allowed to edit code",
    );
    expect(screen.queryByRole("button", { name: "Developer mode" })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("banner")).getByRole("button", { name: "Publish" }),
    ).toBeInTheDocument();
  });
});
