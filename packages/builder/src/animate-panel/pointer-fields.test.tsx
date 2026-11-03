import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  findNode,
  type NodeEffect,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PageBuilder } from "../PageBuilder.js";
import { createMemoryPreferenceStore } from "../preferences/builder-preferences.js";
import type { ImagePicker } from "../panels/content-fields.js";

function cardPage(effects: NodeEffect[] = [{ effect: "magnetic-pull", params: {} }]): PageDocument {
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
          effects,
        },
      ],
    },
    standardCatalogue,
    createCountingNodeIds(),
  );
  return { ...page, root: { ...page.root, children: [section] } };
}

function renderBuilder(
  pick: ImagePicker = async () => ({ src: "/media/harbour.jpg", alt: "", assetId: "a1" }),
  effects?: NodeEffect[],
) {
  const onChange = vi.fn<(document: PageDocument) => void>();
  const pickImage = vi.fn(pick);
  render(
    <PageBuilder
      initialDocument={cardPage(effects)}
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
  const openFields = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(within(screen.getByRole("tree")).getByRole("treeitem", { name: "Project" }));
    await user.click(screen.getByRole("tab", { name: "Animate" }));
    return screen.getByRole("region", { name: "When the pointer is over it" });
  };

  it("is one choice, showing only the chosen option's fields", async () => {
    const user = userEvent.setup();
    const { project } = renderBuilder();
    const fields = await openFields(user);
    const choice = within(fields).getByRole("combobox", { name: "What happens" });
    expect(choice).toHaveValue("none");
    expect(within(fields).queryByRole("combobox", { name: "Word" })).toBeNull();

    await user.selectOptions(choice, "word");
    expect(project()?.effects).toEqual([
      { effect: "magnetic-pull", params: {} },
      { effect: "cursor-word", params: { text: "View" } },
    ]);
    await user.selectOptions(within(fields).getByRole("combobox", { name: "Word" }), "own");
    await user.type(within(fields).getByRole("textbox", { name: "Your word" }), "Visit");
    expect(project()?.effects?.at(-1)?.params.text).toBe("Visit");

    await user.selectOptions(choice, "follow");
    expect(within(fields).queryByRole("combobox", { name: "Word" })).toBeNull();
    await user.click(within(fields).getByRole("button", { name: "Choose a picture" }));
    expect(project()?.effects).toEqual([
      { effect: "magnetic-pull", params: {} },
      { effect: "hover-picture", params: { src: "/media/harbour.jpg", size: "medium" } },
    ]);

    for (const mode of ["grow", "hide", "normal"]) {
      await user.selectOptions(choice, mode);
      expect(project()?.effects).toEqual([
        { effect: "magnetic-pull", params: {} },
        { effect: "cursor-over", params: { mode } },
      ]);
    }
    // Growing needs a custom cursor for the site; this one has none, and says so.
    await user.selectOptions(choice, "grow");
    expect(within(fields).getByText(/Shows once the site has a custom cursor/)).toBeInTheDocument();

    await user.selectOptions(choice, "none");
    expect(project()?.effects).toEqual([{ effect: "magnetic-pull", params: {} }]);
    // They stay out of the Motion panel's own list.
    expect(screen.queryByText("A word on the cursor", { selector: "button *" })).toBeNull();
  });

  it("changes the cursor to a picture, with its size and point, warning when it's large", async () => {
    const user = userEvent.setup();
    const { project } = renderBuilder(async () => ({
      src: "/media/arrow/file",
      alt: "",
      assetId: "arrow",
      bytes: 100 * 1024,
    }));
    const fields = await openFields(user);
    await user.selectOptions(
      within(fields).getByRole("combobox", { name: "What happens" }),
      "picture",
    );
    await user.click(within(fields).getByRole("button", { name: "Choose a picture" }));
    expect(within(fields).getByText(/This picture is 100 kB/)).toBeInTheDocument();
    await user.selectOptions(within(fields).getByRole("combobox", { name: "Size" }), "large");
    await user.selectOptions(
      within(fields).getByRole("combobox", { name: "Where it points" }),
      "top-left",
    );
    expect(project()?.effects?.at(-1)).toEqual({
      effect: "cursor-over",
      params: {
        mode: "picture",
        src: "/media/arrow/file",
        size: 48,
        point: "top-left",
        bytes: 100 * 1024,
      },
    });
  });

  it("gives a word its own look, folded away until asked for", async () => {
    const user = userEvent.setup();
    const { project } = renderBuilder();
    const fields = await openFields(user);
    await user.selectOptions(
      within(fields).getByRole("combobox", { name: "What happens" }),
      "word",
    );
    const changeLook = within(fields).getByRole("button", { name: "Change its look" });
    expect(changeLook).toHaveAttribute("aria-expanded", "false");
    expect(within(fields).queryByRole("radiogroup", { name: "Shape" })).toBeNull();
    await user.click(changeLook);
    await user.click(within(fields).getByRole("radio", { name: "Pill" }));
    const background = within(fields).getByRole("group", { name: /Background/ });
    await user.click(within(background).getByRole("button", { name: "Brand" }));
    expect(project()?.effects?.at(-1)).toEqual({
      effect: "cursor-word",
      params: {
        text: "View",
        background: "var(--lintel-color-brand)",
        colour: "",
        size: "",
        shape: "pill",
      },
    });
  });

  it("reads older pages with a word and a picture both, showing the word", async () => {
    const user = userEvent.setup();
    renderBuilder(undefined, [
      { effect: "cursor-word", params: { text: "View" } },
      { effect: "hover-picture", params: { src: "/a.jpg", size: "medium" } },
    ]);
    const fields = await openFields(user);
    expect(within(fields).getByRole("combobox", { name: "What happens" })).toHaveValue("word");
  });
});
