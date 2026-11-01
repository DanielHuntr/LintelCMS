import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { Field, FieldValue } from "./field.types.js";
import { FieldEditor } from "./FieldEditor.js";

/** Renders one field inside the admin's session and router, recording every value it reports. */
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

  renderScreen(<ControlledField />);
  return { lastValue: () => changes.mock.lastCall?.[0] };
}

const NEWS = {
  id: "t1",
  taxonomyHandle: "categories",
  title: "News",
  slug: "news",
  description: "",
  updatedAt: "",
};
const GUIDES = { ...NEWS, id: "t2", title: "Guides", slug: "guides" };

afterEach(() => vi.restoreAllMocks());

describe("the colour field", () => {
  it("saves a typed code once it's whole, and offers the suggested colours", async () => {
    const { lastValue } = renderField({
      type: "colour",
      label: "Brand",
      options: { swatches: ["#FF0000"] },
    });
    const code = await screen.findByRole("textbox", { name: "Brand" });

    await userEvent.type(code, "#1A2");
    expect(lastValue()).toBeUndefined();
    await userEvent.type(code, "B3C");
    expect(lastValue()).toBe("#1a2b3c");

    await userEvent.click(screen.getByRole("button", { name: "Use #FF0000" }));
    expect(lastValue()).toBe("#ff0000");
    expect(screen.getByRole("button", { name: "Use #FF0000" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("the list field", () => {
  it("adds an item with Enter and leaves blank rows out of the value", async () => {
    const { lastValue } = renderField({ type: "list", label: "Hours" });
    const group = await screen.findByRole("group", { name: "Hours" });

    await userEvent.type(
      within(group).getByRole("textbox", { name: "Hours, item 1" }),
      "Mon 9-5{Enter}",
    );
    await waitFor(() =>
      expect(within(group).getByRole("textbox", { name: "Hours, item 2" })).toHaveFocus(),
    );
    expect(lastValue()).toEqual(["Mon 9-5"]);

    await userEvent.keyboard("Tue 9-1");
    expect(lastValue()).toEqual(["Mon 9-5", "Tue 9-1"]);
    await userEvent.click(screen.getByRole("button", { name: "Remove item 1" }));
    expect(lastValue()).toEqual(["Tue 9-1"]);
  });
});

describe("the markdown field", () => {
  it("previews the text, showing typed HTML as text", async () => {
    renderField({ type: "markdown", label: "Notes" }, "**Bold** <b>raw</b>");
    await screen.findByRole("textbox", { name: "Notes" });

    await userEvent.click(screen.getByRole("radio", { name: "Preview" }));

    const preview = screen.getByLabelText("Preview of Notes");
    expect(preview.querySelector("strong")?.textContent).toBe("Bold");
    expect(preview.querySelector("b")).toBeNull();
    expect(preview).toHaveTextContent("<b>raw</b>");
  });
});

describe("the terms field", () => {
  it("switches terms on and off, and adds a new one that's chosen straight away", async () => {
    const created = { ...NEWS, id: "t3", title: "Recipes", slug: "recipes" };
    const api = mockApi(({ method }) => {
      if (method === "POST") return created;
      return {
        terms: api.calls.some((call) => call.method === "POST")
          ? [GUIDES, NEWS, created]
          : [GUIDES, NEWS],
      };
    });
    const { lastValue } = renderField({
      type: "terms",
      label: "Categories",
      options: { taxonomy: "categories" },
    });

    await userEvent.click(await screen.findByRole("checkbox", { name: "News" }));
    expect(lastValue()).toEqual(["t1"]);

    await userEvent.type(
      screen.getByRole("textbox", { name: "New term for Categories" }),
      "Recipes{Enter}",
    );

    await waitFor(() => expect(lastValue()).toEqual(["t1", "t3"]));
    expect(api.calls.find((call) => call.method === "POST")).toMatchObject({
      url: expect.objectContaining({ pathname: "/taxonomies/categories/terms" }),
      body: { title: "Recipes" },
    });
    expect(await screen.findByRole("checkbox", { name: "Recipes" })).toBeChecked();
  });

  it("uses a single choice when only one term is allowed", async () => {
    mockApi(() => ({ terms: [GUIDES, NEWS] }));
    const { lastValue } = renderField({
      type: "terms",
      label: "Topic",
      options: { taxonomy: "categories", maxItems: 1 },
    });

    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Topic" }), "Guides");
    expect(lastValue()).toEqual(["t2"]);
  });
});

describe("the entries field", () => {
  it("chooses entries from a search, in order, and can move and remove them", async () => {
    const entries = [
      {
        id: "e1",
        title: "Bread",
        slug: "bread",
        status: "published",
        parentId: null,
        locale: "en-GB",
      },
      { id: "e2", title: "Toast", slug: "toast", status: "draft", parentId: null, locale: "en-GB" },
    ];
    mockApi(({ url }) => {
      if (url.pathname === "/collections") {
        return {
          collections: [{ id: "c1", handle: "recipes", name: "Recipes", structure: "flat" }],
        };
      }
      if (url.pathname === "/collections/recipes/entries")
        return { entries, total: 2, page: 1, perPage: 30 };
      const entry = entries.find((candidate) => url.pathname === `/entries/${candidate.id}`);
      return entry;
    });
    const { lastValue } = renderField({
      type: "entries",
      label: "Related",
      options: { collections: ["recipes"] },
    });

    await userEvent.click(await screen.findByRole("button", { name: "Choose an entry" }));
    const dialog = await screen.findByRole("dialog", { name: "Choose for Related" });
    await userEvent.click(await within(dialog).findByRole("button", { name: /Toast/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: /Bread/ }));
    expect(lastValue()).toEqual(["e2", "e1"]);
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));

    await userEvent.click(await screen.findByRole("button", { name: "Move “Bread” up" }));
    expect(lastValue()).toEqual(["e1", "e2"]);
    await userEvent.click(screen.getByRole("button", { name: "Remove “Toast”" }));
    expect(lastValue()).toEqual(["e1"]);
  });
});
