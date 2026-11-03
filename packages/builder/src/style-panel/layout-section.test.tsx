import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type NodeBlueprint,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PageBuilder } from "../PageBuilder.js";
import { createMemoryPreferenceStore } from "../preferences/builder-preferences.js";
import { readArrangement } from "./LayoutSection.js";

function renderBuilder(section: NodeBlueprint) {
  const page = createEmptyPage();
  const document: PageDocument = {
    ...page,
    root: {
      ...page.root,
      children: [createNode(section, standardCatalogue, createCountingNodeIds())],
    },
  };
  const onChange = vi.fn<(document: PageDocument) => void>();
  render(
    <PageBuilder
      initialDocument={document}
      onChange={onChange}
      title="Home"
      canEditCode={false}
      createId={createCountingNodeIds("new")}
      preferences={createMemoryPreferenceStore({ tourSeen: "yes" })}
    />,
  );
  const first = () => (onChange.mock.lastCall?.[0] as PageDocument | undefined)?.root.children[0];
  return { first, onChange };
}

async function openLayout(person: ReturnType<typeof userEvent.setup>, name: string) {
  await person.click(within(screen.getByRole("tree")).getByRole("treeitem", { name }));
  const button = screen
    .getAllByRole("button")
    .find(
      (candidate) =>
        candidate.hasAttribute("aria-expanded") &&
        (candidate.textContent ?? "").startsWith("Layout"),
    );
  if (!button) throw new Error("No Layout group");
  if (button.getAttribute("aria-expanded") !== "true") await person.click(button);
  return button.closest("section") as HTMLElement;
}

function arrangement(group: HTMLElement) {
  return within(group).getByRole("radiogroup", { name: "How things are arranged" });
}

describe("reading how things are arranged", () => {
  it("maps every stored layout onto the four choices", () => {
    expect(readArrangement({}, "flex", "column")).toBe("stack");
    expect(readArrangement({}, "flex", undefined)).toBe("stack");
    expect(readArrangement({}, "flex", "row")).toBe("row");
    expect(readArrangement({}, "inline-flex", "row")).toBe("row");
    expect(readArrangement({}, "grid", undefined)).toBe("grid");
    expect(readArrangement({ placedGrid: { columns: 12 } }, undefined, undefined)).toBe("grid");
    expect(readArrangement({ freeLayout: { stackOnPhone: true } }, "flex", "row")).toBe("free");
    // What "Normal" used to be shows as One under another, without changing anything.
    expect(readArrangement({}, undefined, undefined)).toBe("flow");
    expect(readArrangement({}, "block", undefined)).toBe("flow");
    // Hidden or set by hand in Advanced: none of the four.
    expect(readArrangement({}, "none", undefined)).toBe("other");
  });
});

describe("one control for how things are arranged", () => {
  it("replaces the old Place things and Arrange what's inside controls", async () => {
    const person = userEvent.setup();
    renderBuilder({ type: "section", name: "Intro", styles: { base: { display: "flex" } } });
    const group = await openLayout(person, "Intro");
    const choices = within(arrangement(group)).getAllByRole("radio");
    expect(choices.map((choice) => choice.textContent)).toEqual([
      "One under another",
      "Side by side",
      "On a grid",
      "Anywhere",
    ]);
    expect(screen.queryByRole("radiogroup", { name: "Place things" })).toBeNull();
    expect(within(group).queryByRole("radio", { name: "Normal" })).toBeNull();
  });

  it("shows plain block layout as One under another and leaves it alone until a detail changes", async () => {
    const person = userEvent.setup();
    const { first, onChange } = renderBuilder({
      type: "section",
      name: "Intro",
      styles: { base: { display: undefined, flexDirection: undefined } },
      children: [{ type: "text", props: { text: "Hello" } }],
    });
    const group = await openLayout(person, "Intro");
    expect(
      within(arrangement(group)).getByRole("radio", { name: "One under another" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(onChange).not.toHaveBeenCalled();

    await person.click(within(group).getByRole("button", { name: "M" }));
    expect(first()?.styles.base).toMatchObject({
      display: "flex",
      flexDirection: "column",
      gap: "var(--lintel-space-4)",
    });
  });

  it("puts things side by side, with wrapping as a detail", async () => {
    const person = userEvent.setup();
    const { first } = renderBuilder({ type: "box", name: "Row of things" });
    const group = await openLayout(person, "Row of things");
    await person.click(within(arrangement(group)).getByRole("radio", { name: "Side by side" }));
    expect(first()?.styles.base).toMatchObject({
      display: "flex",
      flexDirection: "row",
      flexWrap: "wrap",
    });
    const wrap = within(group).getByRole("checkbox", { name: "Wrap onto new lines" });
    expect(wrap).toBeChecked();
    await person.click(wrap);
    expect(first()?.styles.base.flexWrap).toBe("nowrap");
  });

  it("goes from Anywhere back to one under another in one place", async () => {
    const person = userEvent.setup();
    const { first } = renderBuilder({
      type: "section",
      name: "Poster",
      children: [{ type: "heading", props: { text: "Hi", level: 2 } }],
    });
    const group = await openLayout(person, "Poster");
    await person.click(within(arrangement(group)).getByRole("radio", { name: "Anywhere" }));
    expect(first()?.freeLayout).toEqual({ stackOnPhone: true });
    expect(
      within(group).getByRole("checkbox", { name: /one under another on phones/ }),
    ).toBeChecked();

    await person.click(
      within(arrangement(group)).getByRole("radio", { name: "One under another" }),
    );
    expect(first()?.freeLayout).toBeUndefined();
    expect(first()?.styles.base).toMatchObject({ display: "flex", flexDirection: "column" });
  });

  it("chooses columns for a grid, and can turn on placing each thing by hand and off again", async () => {
    const person = userEvent.setup();
    const { first } = renderBuilder({ type: "container", name: "Gallery" });
    const group = await openLayout(person, "Gallery");
    await person.click(within(arrangement(group)).getByRole("radio", { name: "On a grid" }));
    await person.click(
      within(within(group).getByRole("radiogroup", { name: "Columns" })).getByRole("radio", {
        name: "3",
      }),
    );
    expect(first()?.styles.base).toMatchObject({
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    });
    const placeByHand = within(group).getByRole("checkbox", {
      name: "Place each thing on the grid yourself",
    });
    await person.click(placeByHand);
    expect(first()?.placedGrid).toEqual({ columns: 12, stackOnPhone: true });
    expect(within(arrangement(group)).getByRole("radio", { name: "On a grid" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await person.click(
      within(group).getByRole("checkbox", { name: "Place each thing on the grid yourself" }),
    );
    expect(first()?.placedGrid).toBeUndefined();
    expect(first()?.styles.base.display).toBe("grid");
  });

  it("offers Anywhere only where things can be placed anywhere", async () => {
    const person = userEvent.setup();
    renderBuilder({
      type: "section",
      name: "Cards",
      children: [{ type: "card", name: "A card", children: [] }],
    });
    const group = await openLayout(person, "A card");
    expect(within(arrangement(group)).queryByRole("radio", { name: "Anywhere" })).toBeNull();
  });
});
