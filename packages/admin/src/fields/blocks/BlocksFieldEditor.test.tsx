import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BlockValue, Field, FieldValue } from "../field.types.js";
import { FieldEditor } from "../FieldEditor.js";

const sectionsField: Field = {
  handle: "sections",
  label: "Page sections",
  type: "blocks",
  required: false,
  options: {
    blockTypes: [
      {
        handle: "hero",
        name: "Hero",
        description: "A big heading at the top of the page.",
        fields: [
          { handle: "heading", label: "Heading", type: "text", required: true, options: {} },
          {
            handle: "subheading",
            label: "Subheading",
            type: "textarea",
            required: false,
            options: {},
          },
        ],
      },
      {
        handle: "faq",
        name: "FAQ",
        description: "One question and its answer.",
        fields: [
          { handle: "question", label: "Question", type: "text", required: true, options: {} },
        ],
      },
    ],
  },
};

function renderBlocks(initial: BlockValue[] | null = null, innerErrors = {}) {
  const changes = vi.fn<(value: FieldValue) => void>();
  function Controlled() {
    const [value, setValue] = useState<unknown>(initial);
    return (
      <FieldEditor
        field={sectionsField}
        value={value}
        innerErrors={innerErrors}
        onChange={(_handle, next) => {
          changes(next);
          setValue(next);
        }}
      />
    );
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Controlled />
    </QueryClientProvider>,
  );
  return { lastValue: () => changes.mock.lastCall?.[0] as BlockValue[] | null | undefined };
}

const twoBlocks: BlockValue[] = [
  { id: "b1", type: "hero", data: { heading: "Fresh bread daily" } },
  { id: "b2", type: "faq", data: { question: "Do you deliver?" } },
];

describe("the blocks field", () => {
  it("starts empty with a way to add the first block, then focuses its first field", async () => {
    const field = renderBlocks();
    expect(screen.getByText("No blocks yet")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add block" }));
    const sheet = screen.getByRole("dialog", { name: "Add a block" });
    expect(within(sheet).getByText("A big heading at the top of the page.")).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole("button", { name: /Hero/ }));

    const heading = await screen.findByRole("textbox", { name: "Heading Required" });
    expect(heading).toHaveFocus();
    await userEvent.type(heading, "Welcome");

    const value = field.lastValue();
    expect(value).toHaveLength(1);
    expect(value?.[0]).toMatchObject({ type: "hero", data: { heading: "Welcome" } });
    expect(value?.[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(screen.getByText("Hero added at position 1.")).toHaveAttribute("role", "status");
  });

  it("moves blocks with the keyboard buttons and says where they went", async () => {
    const field = renderBlocks(twoBlocks);

    await userEvent.click(screen.getByRole("button", { name: "Move Hero down" }));

    expect(field.lastValue()?.map((block) => block.id)).toEqual(["b2", "b1"]);
    expect(screen.getByText("Hero moved to position 2 of 2.")).toHaveAttribute("role", "status");
    expect(screen.getByRole("button", { name: "Move FAQ up" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("collapses a block to a one-line summary, and expands it again", async () => {
    renderBlocks(twoBlocks);
    const toggle = screen.getByRole("button", { name: "Collapse Hero" });

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Fresh bread daily")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Heading Required" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Expand Hero" }));
    expect(screen.getByRole("textbox", { name: "Heading Required" })).toBeVisible();
  });

  it("duplicates a block straight after itself", async () => {
    const field = renderBlocks(twoBlocks);

    await userEvent.click(screen.getByRole("button", { name: "More actions for Hero" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));

    const value = field.lastValue();
    expect(value?.map((block) => block.type)).toEqual(["hero", "hero", "faq"]);
    expect(value?.[1]?.data).toEqual({ heading: "Fresh bread daily" });
    expect(value?.[1]?.id).not.toBe("b1");
  });

  it("asks before removing a block with content, and clears the field when the last goes", async () => {
    const field = renderBlocks([twoBlocks[0] as BlockValue]);

    await userEvent.click(screen.getByRole("button", { name: "More actions for Hero" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Remove" }));
    const confirm = screen.getByRole("alertdialog", { name: "Remove this Hero block?" });
    await userEvent.click(within(confirm).getByRole("button", { name: "Remove" }));

    expect(field.lastValue()).toBeNull();
    expect(screen.getByRole("button", { name: "Add block" })).toHaveFocus();
  });

  it("shows the API's message under the right field of the right block, kept open", async () => {
    renderBlocks(
      [
        { id: "b1", type: "hero", data: { heading: "" } },
        { id: "b2", type: "faq", data: { question: "Do you deliver?" } },
      ],
      { "b1.heading": "Heading is required" },
    );

    expect(screen.getByRole("textbox", { name: "Heading Required" })).toHaveAccessibleDescription(
      "Heading is required",
    );
    expect(screen.getByRole("region", { name: "Hero, block 1 of 2" })).toBeInTheDocument();
  });
});
