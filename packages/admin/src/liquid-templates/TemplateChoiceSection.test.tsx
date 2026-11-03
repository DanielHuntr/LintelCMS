import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { nameInWords, TemplateChoiceSection } from "./TemplateChoiceSection.js";

afterEach(() => vi.restoreAllMocks());

const pages = { handle: "pages", name: "Pages" };

function withTemplates(templates: Array<{ name: string; collectionHandle: string | null }>) {
  return mockApi(({ url }) =>
    url.pathname === "/website/liquid-templates" ? { templates } : undefined,
  );
}

describe("choosing a page's template", () => {
  it("offers the collection's template, the visual design and every other template", async () => {
    withTemplates([
      { name: "landing", collectionHandle: null },
      { name: "pages", collectionHandle: "pages" },
      { name: "pages/wide-photo", collectionHandle: null },
    ]);
    const onChange = vi.fn();
    renderScreen(
      <TemplateChoiceSection collection={pages} value={undefined} onChange={onChange} />,
    );

    const select = await screen.findByRole("combobox", { name: "Page template" });
    expect(
      [...select.querySelectorAll("option")].map((option) => [option.value, option.textContent]),
    ).toEqual([
      ["", "Standard for Pages (code template)"],
      ["designed", "Visual design"],
      ["landing", "Landing"],
      ["pages/wide-photo", "Pages / Wide photo"],
    ]);
    expect(select).toHaveValue("");
    expect(screen.getByText(/goes live when you publish/)).toBeInTheDocument();

    await userEvent.selectOptions(select, "landing");
    expect(onChange).toHaveBeenLastCalledWith("landing");
    await userEvent.selectOptions(select, "");
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("shows the stored choice, even one whose file has gone", async () => {
    withTemplates([{ name: "landing", collectionHandle: null }]);
    renderScreen(<TemplateChoiceSection collection={pages} value="old-one" onChange={vi.fn()} />);
    const select = await screen.findByRole("combobox", { name: "Page template" });
    expect(select).toHaveValue("old-one");
    expect(screen.getByRole("option", { name: "Standard for Pages" })).toBeInTheDocument();
  });

  it("isn't shown when the install has no templates", async () => {
    const api = withTemplates([]);
    renderScreen(<TemplateChoiceSection collection={pages} value={undefined} onChange={vi.fn()} />);
    await waitFor(() => expect(api.calls).toHaveLength(1));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText("Template")).not.toBeInTheDocument();
  });

  it("reads file names as words", () => {
    expect(nameInWords("blog_post")).toBe("Blog post");
  });
});
