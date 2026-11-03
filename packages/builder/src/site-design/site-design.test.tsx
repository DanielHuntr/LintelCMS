import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  emptySiteDesign,
  type PageDocument,
  type SiteDesign,
  standardCatalogue,
} from "@lintel/builder-model";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PageBuilder } from "../PageBuilder.js";
import { createMemoryPreferenceStore } from "../preferences/builder-preferences.js";

function renderBuilder(start: SiteDesign = emptySiteDesign, canChange = true) {
  const page = createEmptyPage();
  const section = createNode(
    {
      type: "section",
      name: "Cards",
      placedGrid: { columns: 12, stackOnPhone: true },
      children: [
        {
          type: "box",
          name: "First card",
          styles: { base: { backgroundColor: "#ffffff", borderRadius: "8px", zIndex: "2" } },
        },
        { type: "box", name: "Second card", styles: { base: { backgroundColor: "red" } } },
      ],
    },
    standardCatalogue,
    createCountingNodeIds(),
  );
  const document: PageDocument = { ...page, root: { ...page.root, children: [section] } };
  const onChange = vi.fn<(document: PageDocument) => void>();
  const onDesignChange = vi.fn<(design: SiteDesign) => void>();
  function Harness() {
    const [design, setDesign] = useState(start);
    return (
      <PageBuilder
        initialDocument={document}
        onChange={onChange}
        title="Home"
        canEditCode={false}
        createId={createCountingNodeIds("new")}
        preferences={createMemoryPreferenceStore({ tourSeen: "yes", skillLevel: "designer" })}
        siteDesign={{
          value: design,
          onChange: canChange
            ? (next) => {
                onDesignChange(next);
                setDesign(next);
              }
            : undefined,
        }}
      />
    );
  }
  render(<Harness />);
  const latest = () => onChange.mock.lastCall?.[0] as PageDocument;
  const node = (name: string) =>
    latest().root.children[0]?.children.find((child) => child.name === name);
  const design = () => onDesignChange.mock.lastCall?.[0] as SiteDesign;
  return { node, design };
}

async function select(person: ReturnType<typeof userEvent.setup>, name: string) {
  await person.click(within(screen.getByRole("tree")).getByRole("treeitem", { name }));
}

/** Opens a collapsible group of the Style panel, and gives back what's in it. */
async function open(person: ReturnType<typeof userEvent.setup>, title: string) {
  const button = screen
    .getAllByRole("button")
    .find(
      (each) =>
        each.hasAttribute("aria-expanded") &&
        !each.hasAttribute("aria-haspopup") &&
        (each.textContent ?? "").startsWith(title),
    );
  if (!button) throw new Error(`No collapsible group called ${title}`);
  if (button.getAttribute("aria-expanded") !== "true") await person.click(button);
  return button.closest("section") as HTMLElement;
}

describe("shared styles in the Style panel", () => {
  it("makes a shared style from a look, uses it on another element, edits it and detaches", async () => {
    const person = userEvent.setup();
    const { node, design } = renderBuilder();
    await select(person, "First card");
    await person.selectOptions(
      screen.getByRole("combobox", { name: "Shared style" }),
      "Make one from this look…",
    );
    const name = screen.getByRole("textbox", { name: "Name for this look" });
    await person.clear(name);
    await person.type(name, "Card{Enter}");
    expect(design().sharedStyles).toEqual([
      {
        id: "card",
        name: "Card",
        styles: { base: { backgroundColor: "#ffffff", borderRadius: "8px" } },
      },
    ]);
    expect(node("First card")).toMatchObject({
      sharedStyle: "card",
      styles: { base: { zIndex: "2" } },
    });
    expect(screen.getByText("1 on this page")).toBeInTheDocument();

    await select(person, "Second card");
    await person.selectOptions(screen.getByRole("combobox", { name: "Shared style" }), "Card");
    expect(node("Second card")).toMatchObject({ sharedStyle: "card", styles: { base: {} } });
    expect(screen.getByText("2 on this page")).toBeInTheDocument();

    // Where it sits stays its own, even while changes go to the shared style.
    const arrange = await open(person, "Arrange");
    await person.selectOptions(within(arrange).getByRole("combobox", { name: "Last column" }), "4");
    expect(node("Second card")?.styles.base.gridColumn).toBe("1 / span 4");
    expect(design().sharedStyles[0]?.styles.base.gridColumn).toBeUndefined();

    // Every "Card" by default: the change goes to the shared style.
    const spacing = screen.getByRole("group", { name: "Space inside" });
    await person.click(within(spacing).getByRole("button", { name: "L" }));
    expect(design().sharedStyles[0]?.styles.base).toMatchObject({
      paddingTop: "var(--lintel-space-5)",
    });
    expect(node("Second card")?.styles.base.paddingTop).toBeUndefined();

    // Only this one: the change stays on the element.
    await person.click(screen.getByRole("radio", { name: "Only this one" }));
    await person.click(
      within(screen.getByRole("group", { name: "Space inside" })).getByRole("button", {
        name: "XL",
      }),
    );
    expect(node("Second card")?.styles.base.paddingTop).toBe("var(--lintel-space-6)");
    expect(design().sharedStyles[0]?.styles.base.paddingTop).toBe("var(--lintel-space-5)");

    await person.click(screen.getByRole("button", { name: "Detach" }));
    expect(node("Second card")?.sharedStyle).toBeUndefined();
    expect(node("Second card")?.styles.base).toMatchObject({
      backgroundColor: "#ffffff",
      borderRadius: "8px",
      paddingTop: "var(--lintel-space-6)",
    });
  });

  it("only offers the site's shared styles to people who can't change them", async () => {
    const person = userEvent.setup();
    renderBuilder(
      { variables: [], sharedStyles: [{ id: "card", name: "Card", styles: { base: {} } }] },
      false,
    );
    await select(person, "First card");
    const choices = within(screen.getByRole("combobox", { name: "Shared style" }))
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(choices).toEqual(["None", "Card"]);
  });
});

describe("the site's design variables", () => {
  it("adds a colour with nothing selected, which elements can then use", async () => {
    const person = userEvent.setup();
    const { node, design } = renderBuilder();
    expect(screen.getByRole("heading", { name: "Site styles" })).toBeInTheDocument();
    await person.click(screen.getByRole("button", { name: "Add a colour" }));
    expect(design().variables).toEqual([
      { id: "new-colour", name: "New colour", kind: "colour", value: "#8e8e93" },
    ]);
    const value = screen.getByRole("textbox", { name: "New colour: Value" });
    await person.clear(value);
    await person.type(value, "#efe6d6{Enter}");
    expect(design().variables[0]?.value).toBe("#efe6d6");

    await select(person, "Second card");
    const background = await open(person, "Background");
    await person.click(within(background).getByRole("button", { name: "New colour" }));
    expect(node("Second card")?.styles.base.backgroundColor).toBe("var(--lintel-var-new-colour)");
  });

  it("saves a colour picked by hand as a site colour", async () => {
    const person = userEvent.setup();
    const { node, design } = renderBuilder();
    await select(person, "First card");
    const background = await open(person, "Background");
    await person.click(within(background).getByRole("button", { name: "Save as a site colour" }));
    await person.type(
      screen.getByRole("textbox", { name: "Name for this colour" }),
      "Paper{Enter}",
    );
    expect(design().variables).toEqual([
      { id: "paper", name: "Paper", kind: "colour", value: "#ffffff" },
    ]);
    expect(node("First card")?.styles.base.backgroundColor).toBe("var(--lintel-var-paper)");
  });

  it("refuses a value that isn't one, saying so", async () => {
    const person = userEvent.setup();
    const { design } = renderBuilder();
    await person.click(screen.getByRole("button", { name: "Add a size" }));
    const value = screen.getByRole("textbox", { name: "New size: Value" });
    await person.clear(value);
    await person.type(value, "huge{Enter}");
    expect(screen.getByText("That isn’t a size this can use")).toBeInTheDocument();
    expect(design().variables[0]?.value).toBe("2rem");
  });
});
