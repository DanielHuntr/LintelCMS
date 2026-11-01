import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { BlueprintEditor } from "./BlueprintEditor.js";
import type { Blueprint } from "./blueprints.types.js";

const blueprint: Blueprint = {
  id: "b1",
  handle: "page",
  name: "Page",
  kind: "entry",
  version: 1,
  updatedAt: "2026-10-01T09:00:00.000Z",
  fields: [
    { handle: "title", label: "Title", type: "text", required: true, options: {} },
    { handle: "summary", label: "Summary", type: "textarea", required: false, options: {} },
  ],
};

const fieldtypes = [
  { type: "text", name: "Text", description: "A single line." },
  { type: "image", name: "Image", description: "A picture from the media library." },
];

function fieldLabels() {
  const list = screen.getByRole("list", { name: "Fields" });
  // Each row's main button opens the field's settings and is named "Label, Type · handle".
  return within(list)
    .getAllByRole("button")
    .filter((button) => button.getAttribute("aria-haspopup") === "dialog")
    .map((button) => button.textContent?.split(", ")[0]);
}

afterEach(() => vi.restoreAllMocks());

describe("BlueprintEditor", () => {
  it("adds a field from the sheet, reorders it with the keyboard, and saves the new order", async () => {
    const api = mockApi(({ method, url, body }) => {
      if (url.pathname === "/fieldtypes") return { fieldtypes };
      if (method === "PUT") return { ...blueprint, ...(body as object), version: 2 };
      throw new Error(`Unexpected ${method} ${url.pathname}`);
    });
    renderScreen(<BlueprintEditor blueprint={blueprint} />);
    await screen.findByRole("heading", { name: "Page" });

    await userEvent.click(screen.getByRole("button", { name: "Add field" }));
    await userEvent.click(await screen.findByRole("button", { name: /Image/ }));
    const label = await screen.findByRole("textbox", { name: "Label" });
    await userEvent.clear(label);
    await userEvent.type(label, "Hero image");
    expect(screen.getByRole("textbox", { name: "Handle" })).toHaveValue("hero_image");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));

    await userEvent.click(screen.getByRole("button", { name: "Move “Hero image” up" }));
    expect(fieldLabels()).toEqual(["Title", "Hero image", "Summary"]);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.calls.some(({ method }) => method === "PUT")).toBe(true));
    const saved = api.calls.find(({ method }) => method === "PUT")?.body as Blueprint;
    expect(saved.fields.map((field) => field.handle)).toEqual(["title", "hero_image", "summary"]);
  });

  it("removes a saved field only after asking", async () => {
    mockApi(() => ({ fieldtypes }));
    renderScreen(<BlueprintEditor blueprint={blueprint} />);
    await screen.findByRole("heading", { name: "Page" });

    await userEvent.click(screen.getByRole("button", { name: "Remove “Summary”" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Remove “Summary”?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove field" }));

    expect(fieldLabels()).toEqual(["Title"]);
  });

  it("keeps the title locked first, with no move or remove buttons", async () => {
    mockApi(() => ({ fieldtypes }));
    renderScreen(<BlueprintEditor blueprint={blueprint} />);
    await screen.findByRole("heading", { name: "Page" });

    expect(screen.queryByRole("button", { name: "Move “Title” down" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove “Title”" })).not.toBeInTheDocument();
    expect(screen.getByText("Always first")).toBeInTheDocument();
  });
});
