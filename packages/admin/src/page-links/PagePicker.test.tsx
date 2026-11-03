import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FieldValue, RichTextDocument } from "../fields/field.types.js";
import { FieldEditor } from "../fields/FieldEditor.js";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";

function servePages() {
  return mockApi(({ url }) => {
    if (url.pathname === "/content-tree/search") {
      return {
        items: [
          {
            id: "about",
            title: "About us",
            status: "published",
            collection: { handle: "pages", name: "Pages" },
            url: "/about-us",
          },
          {
            id: "about-footer",
            title: "About the footer",
            status: "draft",
            collection: { handle: "snippets", name: "Snippets" },
            url: null,
          },
        ],
      };
    }
    throw new Error(`Unexpected request to ${url.pathname}`);
  });
}

function renderField(type: "link" | "richText", initialValue: unknown = undefined) {
  const changes = vi.fn<(value: FieldValue) => void>();
  function ControlledField() {
    const [value, setValue] = useState(initialValue);
    return (
      <FieldEditor
        field={{ handle: "field", label: "Read more", type, required: false, options: {} }}
        value={value}
        onChange={(_handle, next) => {
          changes(next);
          setValue(next);
        }}
      />
    );
  }
  renderScreen(<ControlledField />);
  return changes;
}

async function choose(search: string, title: string) {
  await userEvent.click(await screen.findByRole("button", { name: "Choose a page…" }));
  const dialog = await screen.findByRole("dialog", { name: "Choose a page" });
  await userEvent.type(within(dialog).getByRole("searchbox"), search);
  const results = await within(dialog).findByRole("list", { name: "Pages" });
  return { dialog, results, pick: () => userEvent.click(within(results).getByText(title)) };
}

afterEach(() => vi.restoreAllMocks());

describe("choosing a page for a link", () => {
  it("finds pages by title and fills in the address, and the words when there are none", async () => {
    const api = servePages();
    const changes = renderField("link");

    const { results, pick } = await choose("abo", "About us");

    expect(within(results).getByText("/about-us")).toBeInTheDocument();
    // Entries without a page of their own can't be linked to, so they aren't offered.
    expect(within(results).queryByText("About the footer")).not.toBeInTheDocument();
    expect(
      api.calls
        .find(({ url }) => url.pathname === "/content-tree/search")
        ?.url.searchParams.get("search"),
    ).toBe("abo");
    await pick();

    expect(screen.queryByRole("dialog", { name: "Choose a page" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Address")).toHaveValue("/about-us");
    expect(screen.getByLabelText("Link text")).toHaveValue("About us");
    expect(changes.mock.lastCall?.[0]).toEqual({ url: "/about-us", label: "About us" });
  });

  it("keeps words already typed, and a typed web address still works", async () => {
    servePages();
    const changes = renderField("link", { url: "https://example.com", label: "Our story" });

    const { pick } = await choose("about", "About us");
    await pick();

    expect(changes.mock.lastCall?.[0]).toEqual({ url: "/about-us", label: "Our story" });
    await userEvent.clear(screen.getByLabelText("Address"));
    await userEvent.type(screen.getByLabelText("Address"), "https://lintel.dev");
    expect(changes.mock.lastCall?.[0]).toEqual({ url: "https://lintel.dev", label: "Our story" });
  });

  it("links the selected words in rich text to the page's address", async () => {
    servePages();
    const document: RichTextDocument = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Meet the team" }] }],
    };
    const changes = renderField("richText", document);
    const editor = await screen.findByRole("textbox", { name: "Read more" });
    await userEvent.click(editor);
    await userEvent.keyboard("{Control>}a{/Control}");
    await userEvent.click(screen.getByRole("button", { name: "Link" }));

    const { pick } = await choose("abo", "About us");
    await pick();

    await waitFor(() =>
      expect((changes.mock.lastCall?.[0] as RichTextDocument).content?.[0]).toMatchObject({
        content: [
          {
            text: "Meet the team",
            marks: [{ type: "link", attrs: { href: "/about-us" } }],
          },
        ],
      }),
    );
  });
});
