import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  findNode,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PageBuilder } from "../PageBuilder.js";
import { createMemoryPreferenceStore } from "../preferences/builder-preferences.js";

function cardPage(): PageDocument {
  const page = createEmptyPage();
  const section = createNode(
    {
      type: "section",
      name: "Work",
      children: [
        {
          type: "heading",
          name: "Project",
          props: { text: "Harbour house", level: 2 },
          effects: [{ effect: "magnetic-pull", params: {} }],
        },
      ],
    },
    standardCatalogue,
    createCountingNodeIds(),
  );
  return { ...page, root: { ...page.root, children: [section] } };
}

function renderBuilder() {
  const onChange = vi.fn<(document: PageDocument) => void>();
  const pickImage = vi.fn(async () => ({ src: "/media/harbour.jpg", alt: "", assetId: "a1" }));
  render(
    <PageBuilder
      initialDocument={cardPage()}
      onChange={onChange}
      title="Work"
      canEditCode={false}
      createId={createCountingNodeIds("new")}
      preferences={createMemoryPreferenceStore({ tourSeen: "yes" })}
      pickImage={pickImage}
    />,
  );
  const project = () => findNode((onChange.mock.lastCall?.[0] as PageDocument).root, "n2");
  return { project };
}

describe("when the pointer is over an element", () => {
  it("sets a word for the cursor and a picture shown on hover, each with one choice", async () => {
    const user = userEvent.setup();
    const { project } = renderBuilder();
    await user.click(within(screen.getByRole("tree")).getByRole("treeitem", { name: "Project" }));
    await user.click(screen.getByRole("tab", { name: "Animate" }));
    const fields = screen.getByRole("region", { name: "When the pointer is over it" });

    await user.selectOptions(
      within(fields).getByRole("combobox", { name: "Word on the cursor" }),
      "view",
    );
    expect(project()?.effects).toEqual([
      { effect: "magnetic-pull", params: {} },
      { effect: "cursor-word", params: { text: "View" } },
    ]);

    await user.click(within(fields).getByRole("switch", { name: "Show a picture when hovered" }));
    await user.click(within(fields).getByRole("button", { name: "Choose a picture" }));
    expect(project()?.effects?.at(-1)).toEqual({
      effect: "hover-picture",
      params: { src: "/media/harbour.jpg", assetId: "a1", size: "medium" },
    });

    // They stay out of the Motion panel's own list, which still shows the magnetic pull.
    expect(screen.queryByText("Word on the cursor", { selector: "button *" })).toBeNull();

    await user.selectOptions(
      within(fields).getByRole("combobox", { name: "Word on the cursor" }),
      "own",
    );
    await user.type(within(fields).getByRole("textbox", { name: "Your word" }), "Visit");
    expect(project()?.effects?.find((effect) => effect.effect === "cursor-word")?.params.text).toBe(
      "Visit",
    );

    await user.click(within(fields).getByRole("switch", { name: "Show a picture when hovered" }));
    await user.selectOptions(
      within(fields).getByRole("combobox", { name: "Word on the cursor" }),
      "none",
    );
    expect(project()?.effects).toEqual([{ effect: "magnetic-pull", params: {} }]);
  });
});
