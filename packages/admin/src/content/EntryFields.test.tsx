import { createEmptyPage } from "@lintel/builder-model";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Field } from "../fields/field.types.js";
import { renderScreen } from "../testing/renderScreen.js";
import { EntryFields } from "./EntryFields.js";

const fields: Field[] = [
  { handle: "title", label: "Title", type: "text", required: true, options: {} },
  { handle: "summary", label: "Summary", type: "textarea", required: false, options: {} },
  { handle: "body", label: "Body", type: "textarea", required: false, options: {} },
];

const emptyPage = createEmptyPage();
const designed = {
  ...emptyPage,
  root: {
    ...emptyPage.root,
    children: [{ id: "s1", type: "section", name: "Hero", props: {}, styles: {}, children: [] }],
  },
};

function renderFields(design: unknown, errors: Record<string, string> = {}) {
  renderScreen(
    <EntryFields
      fields={fields}
      data={{ title: "Home", summary: "Fresh bread", body: "Our story", design }}
      errors={errors}
      onChange={vi.fn()}
    />,
  );
}

const note = /This page has a design, so your website shows the design instead of: Body/;

describe("an entry's fields on a page with a design", () => {
  // LINTEL-UX-006: Body text vanished from the website once the page had a design, while
  // the editor still offered it as if it were shown.
  it("keeps Body behind a note, since the website shows the design instead", async () => {
    renderFields(designed);

    expect(await screen.findByText(note)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Body" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Summary" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Show them anyway" }));
    expect(screen.getByRole("textbox", { name: "Body" })).toHaveValue("Our story");
  });

  it("shows Body as usual while the design is empty", async () => {
    renderFields(emptyPage);

    expect(await screen.findByRole("textbox", { name: "Body" })).toBeInTheDocument();
    expect(screen.queryByText(note)).not.toBeInTheDocument();
  });

  it("opens Body by itself when it has a problem to fix", async () => {
    renderFields(designed, { body: "Body is too long." });

    expect(await screen.findByRole("textbox", { name: /Body/ })).toBeInTheDocument();
  });
});
