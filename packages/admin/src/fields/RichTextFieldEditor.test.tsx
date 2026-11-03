import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithQueries } from "../media/media.test-helpers.js";
import type { FieldValue, RichTextDocument } from "./field.types.js";
import { FieldEditor } from "./FieldEditor.js";

const article: RichTextDocument = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hello there" }] }],
};

function renderRichText(value: unknown) {
  const onChange = vi.fn<(handle: string, value: FieldValue) => void>();
  // With a query cache: pictures look their images up through it.
  renderWithQueries(
    <FieldEditor
      field={{ handle: "body", label: "Body", type: "richText", required: false, options: {} }}
      value={value}
      onChange={onChange}
    />,
  );
  return onChange;
}

describe("rich text", () => {
  it("shows the stored document in a text box named by the field's label", () => {
    renderRichText(article);

    const editor = screen.getByRole("textbox", { name: "Body" });
    expect(editor).toHaveTextContent("Hello there");
    expect(editor).toHaveAttribute("aria-multiline", "true");
  });

  it("stores formatting changes as a TipTap JSON document", async () => {
    const onChange = renderRichText(article);

    await userEvent.click(screen.getByRole("button", { name: "Heading" }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const [handle, document] = onChange.mock.lastCall ?? [];
    expect(handle).toBe("body");
    expect(document).toMatchObject({ type: "doc" });
    expect((document as RichTextDocument).content?.[0]).toMatchObject({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Hello there" }],
    });
  });

  it("has a toolbar that is one tab stop, with arrow keys between its buttons", async () => {
    renderRichText(article);
    const toolbar = screen.getByRole("toolbar", { name: "Formatting" });

    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Heading" })).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Subheading" })).toHaveFocus();
    expect(toolbar.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
  });

  it("starts empty when there is no document yet", () => {
    renderRichText(null);

    expect(screen.getByRole("textbox", { name: "Body" })).toHaveTextContent("");
  });
});
