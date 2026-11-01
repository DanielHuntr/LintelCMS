import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { postsCollection, samplePost } from "../content/testEntries.js";
import type { Field } from "../fields/field.types.js";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { BuiltInPreview } from "./BuiltInPreview.js";
import { EntryPreviewPane } from "./EntryPreviewPane.js";

const fields: Field[] = [
  { handle: "title", label: "Title", type: "text", required: true, options: {} },
  { handle: "summary", label: "Summary", type: "textarea", required: false, options: {} },
  {
    handle: "sections",
    label: "Sections",
    type: "blocks",
    required: false,
    options: {
      blockTypes: [
        { handle: "hero", name: "Hero", fields: [] },
        { handle: "faq", name: "FAQ", fields: [] },
        {
          handle: "quote",
          name: "Quote",
          fields: [{ handle: "words", label: "Words", type: "text", required: false, options: {} }],
        },
      ],
    },
  },
];

const delivered = {
  id: "p1",
  slug: "hello-world",
  url: "/blog/hello-world",
  publishedAt: null,
  data: {
    title: "Hello world",
    summary: "A short hello",
    sections: [
      {
        id: "b1",
        type: "hero",
        data: { heading: "Fresh bread daily", button: { url: "/menu", label: "See the menu" } },
      },
      {
        id: "b2",
        type: "faq",
        data: {
          question: "Do you deliver?",
          answer: { json: {}, html: "<p>Yes, <strong>daily</strong>.</p>" },
        },
      },
      { id: "b3", type: "quote", data: { words: "Best loaf in town" } },
    ],
  },
};

afterEach(() => vi.restoreAllMocks());

describe("BuiltInPreview", () => {
  it("draws the default blocks like a simple site, and any other block field by field", async () => {
    renderScreen(<BuiltInPreview entry={delivered} fields={fields} />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Hello world" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Fresh bread daily" }),
    ).toBeInTheDocument();
    expect(screen.getByText("See the menu")).toBeInTheDocument();
    expect(screen.getByText("Do you deliver?")).toBeInTheDocument();
    expect(screen.getByText("daily", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Best loaf in town")).toBeInTheDocument();
  });
});

describe("EntryPreviewPane", () => {
  it("shows Lintel's own preview of the saved draft when no site is connected", async () => {
    const api = mockApi(({ method, url }) => {
      if (method === "POST" && url.pathname === "/entries/p1/preview") {
        return { token: "signed.token", expiresAt: "2026-11-01T10:00:00Z", previewUrl: null };
      }
      if (url.pathname === "/preview") return { collection: "posts", entry: delivered };
      throw new Error(`Unexpected ${method} ${url.pathname}`);
    });

    renderScreen(
      <EntryPreviewPane
        id="preview"
        collection={postsCollection}
        entry={samplePost()}
        fields={fields}
        title="Hello world"
        onClose={() => undefined}
      />,
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "Hello world" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No website connected yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set up a preview address" })).toBeInTheDocument();
    const draftRequest = api.calls.find(({ url }) => url.pathname === "/preview");
    expect(draftRequest?.url.searchParams.get("token")).toBe("signed.token");
  });

  it("shows the website itself in a frame once a preview address is set", async () => {
    mockApi(() => ({
      token: "signed.token",
      expiresAt: "2026-11-01T10:00:00Z",
      previewUrl: "https://example.com/preview?token=signed.token",
    }));

    renderScreen(
      <EntryPreviewPane
        id="preview"
        collection={{ ...postsCollection, previewUrlPattern: "https://example.com/preview" }}
        entry={samplePost()}
        fields={fields}
        title="Hello world"
        onClose={() => undefined}
      />,
    );

    const frame = await screen.findByTitle("Preview of Hello world");
    expect(frame).toHaveAttribute("src", "https://example.com/preview?token=signed.token");
    expect(screen.getByRole("link", { name: "Open in a new tab" })).toHaveAttribute(
      "href",
      "https://example.com/preview?token=signed.token",
    );
  });

  it("explains that a new entry needs saving first, and closes", async () => {
    mockApi(() => {
      throw new Error("Nothing should be asked for");
    });
    const onClose = vi.fn();

    renderScreen(
      <EntryPreviewPane
        id="preview"
        collection={postsCollection}
        entry={undefined}
        fields={fields}
        title=""
        onClose={onClose}
      />,
    );

    const pane = await screen.findByRole("complementary", { name: "Preview" });
    expect(within(pane).getByText("Nothing to preview yet")).toBeInTheDocument();
    await userEvent.click(within(pane).getByRole("button", { name: "Close preview" }));
    expect(onClose).toHaveBeenCalled();
  });
});
