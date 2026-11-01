import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Field, FieldValue } from "./field.types.js";
import { FieldEditor } from "./FieldEditor.js";

/** Renders one field the way the entry editor does, and records every value it reports. */
function renderField(
  field: Partial<Field> & Pick<Field, "type">,
  initialValue: unknown = undefined,
) {
  const changes = vi.fn<(value: FieldValue) => void>();
  const fullField: Field = {
    handle: "field",
    label: "Field",
    required: false,
    options: {},
    ...field,
  };

  function ControlledField() {
    const [value, setValue] = useState(initialValue);
    return (
      <FieldEditor
        field={fullField}
        value={value}
        onChange={(_handle, next) => {
          changes(next);
          setValue(next);
        }}
      />
    );
  }

  // The image field's MediaPicker loads the chosen asset, so it needs a query cache.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ControlledField />
    </QueryClientProvider>,
  );
  return { lastValue: () => changes.mock.lastCall?.[0], changes };
}

const categoryChoices = [
  { value: "news", label: "News" },
  { value: "guides", label: "Guides" },
  { value: "updates", label: "Updates" },
];

describe("text and textarea", () => {
  it("stores what is typed", async () => {
    const field = renderField({ type: "text", label: "Headline" });

    await userEvent.type(screen.getByLabelText("Headline"), "Hello");

    expect(field.lastValue()).toBe("Hello");
  });

  it("counts characters against the limit and stops typing at it", async () => {
    renderField({ type: "textarea", label: "Summary", options: { maxLength: 8 } }, "Hi");

    expect(screen.getByText("2 / 8")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Summary"), " there, friend");

    expect(screen.getByLabelText("Summary")).toHaveValue("Hi there");
    expect(screen.getByText("8 / 8")).toBeInTheDocument();
  });

  it("reads a value of the wrong type as empty instead of crashing", () => {
    renderField({ type: "text", label: "Headline" }, 42);

    expect(screen.getByLabelText("Headline")).toHaveValue("");
  });
});

describe("number", () => {
  it("stores numbers, and empty (not 0) when cleared", async () => {
    const field = renderField({ type: "number", label: "Price", options: { min: 0 } }, 5);
    const input = screen.getByLabelText("Price");

    await userEvent.clear(input);
    expect(field.lastValue()).toBeNull();

    await userEvent.type(input, "12.5");
    expect(field.lastValue()).toBe(12.5);
    expect(input).toHaveAttribute("min", "0");
  });
});

describe("toggle", () => {
  it("is a switch named by the field's label that stores true and false", async () => {
    const field = renderField({ type: "toggle", label: "Show on the home page" });

    await userEvent.click(screen.getByRole("switch", { name: "Show on the home page" }));
    expect(field.lastValue()).toBe(true);

    await userEvent.click(screen.getByRole("switch"));
    expect(field.lastValue()).toBe(false);
  });
});

describe("select", () => {
  it("stores one choice, or empty for None", async () => {
    const field = renderField({
      type: "select",
      label: "Category",
      options: { choices: categoryChoices },
    });
    const select = screen.getByLabelText("Category");

    await userEvent.selectOptions(select, "Guides");
    expect(field.lastValue()).toBe("guides");

    await userEvent.selectOptions(select, "None");
    expect(field.lastValue()).toBeNull();
  });

  it("stores several choices as a list, in the order they're listed", async () => {
    const field = renderField({
      type: "select",
      label: "Topics",
      options: { choices: categoryChoices, multiple: true },
    });

    await userEvent.click(screen.getByRole("checkbox", { name: "Updates" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "News" }));
    expect(field.lastValue()).toEqual(["news", "updates"]);

    await userEvent.click(screen.getByRole("checkbox", { name: "Updates" }));
    expect(field.lastValue()).toEqual(["news"]);
    expect(screen.getByRole("group", { name: "Topics" })).toBeInTheDocument();
  });
});

describe("date", () => {
  it("stores a plain date as YYYY-MM-DD", () => {
    const field = renderField({ type: "date", label: "Event day" });

    fireEvent.change(screen.getByLabelText("Event day"), { target: { value: "2026-11-01" } });

    expect(field.lastValue()).toBe("2026-11-01");
  });

  it("stores a date and time as an ISO datetime in the browser's time zone", () => {
    const field = renderField({ type: "date", label: "Starts", options: { includeTime: true } });

    fireEvent.change(screen.getByLabelText("Starts"), { target: { value: "2026-11-01T09:30" } });

    expect(field.lastValue()).toBe(new Date("2026-11-01T09:30").toISOString());
  });

  it("stores empty when cleared", () => {
    const field = renderField({ type: "date", label: "Event day" }, "2026-11-01");

    fireEvent.change(screen.getByLabelText("Event day"), { target: { value: "" } });

    expect(field.lastValue()).toBeNull();
  });
});

describe("link", () => {
  it("stores the address and the link text together", async () => {
    const field = renderField({ type: "link", label: "Call to action" });

    await userEvent.type(screen.getByLabelText("Address"), "https://lintel.dev");
    await userEvent.type(screen.getByLabelText("Link text"), "Try it");

    expect(field.lastValue()).toEqual({ url: "https://lintel.dev", label: "Try it" });
    expect(screen.getByRole("group", { name: "Call to action" })).toBeInTheDocument();
  });

  it("stores empty when the address is cleared, but keeps the words on screen", async () => {
    const field = renderField(
      { type: "link", label: "More" },
      { url: "https://a.example", label: "Read" },
    );

    await userEvent.clear(screen.getByLabelText("Address"));

    expect(field.lastValue()).toBeNull();
    expect(screen.getByLabelText("Link text")).toHaveValue("Read");
  });
});

describe("image", () => {
  it("passes the asset id to the media picker and stores empty when removed", async () => {
    const field = renderField({ type: "image", label: "Hero image" }, "asset-1");

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(field.lastValue()).toBeNull();
  });
});

describe("the field around every editor", () => {
  it("shows Required, and reads help text and the API's error to screen readers", () => {
    render(
      <FieldEditor
        field={{
          handle: "excerpt",
          label: "Excerpt",
          type: "textarea",
          required: true,
          helpText: "Shown on the blog's index.",
          options: {},
        }}
        value=""
        onChange={() => undefined}
        error="Add an excerpt."
      />,
    );

    const input = screen.getByRole("textbox", { name: "Excerpt Required" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input).toHaveAccessibleDescription("Shown on the blog's index. Add an excerpt.");
  });

  it("says so, instead of breaking, for a fieldtype it doesn't know", () => {
    render(
      <FieldEditor
        field={{
          handle: "map",
          label: "Map",
          type: "map" as Field["type"],
          required: false,
          options: {},
        }}
        value={null}
        onChange={() => undefined}
      />,
    );

    expect(screen.getByText("This kind of field can’t be edited here yet.")).toBeInTheDocument();
  });
});
