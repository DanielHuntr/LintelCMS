import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  emptySiteDesign,
  type PageDocument,
  type PageNode,
  type SiteDesign,
  standardCatalogue,
} from "@lintel/builder-model";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PageBuilder } from "../PageBuilder.js";
import { createMemoryPreferenceStore } from "../preferences/builder-preferences.js";

const ink: SiteDesign = {
  variables: [{ id: "ink", name: "Ink", kind: "colour", value: "#1f2328" }],
  sharedStyles: [],
};

function renderBuilder(
  start: SiteDesign = emptySiteDesign,
  children?: PageNode[],
  skillLevel = "designer",
) {
  const page = createEmptyPage();
  const ids = createCountingNodeIds();
  const section = children ?? [
    createNode(
      {
        type: "section",
        name: "Cards",
        children: [
          {
            type: "box",
            name: "First card",
            styles: { base: { backgroundColor: "var(--lintel-var-ink)" } },
          },
          { type: "box", name: "Second card", styles: { base: { backgroundColor: "red" } } },
        ],
      },
      standardCatalogue,
      ids,
    ),
  ];
  const document: PageDocument = { ...page, root: { ...page.root, children: section } };
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
        preferences={createMemoryPreferenceStore({ tourSeen: "yes", skillLevel })}
        siteDesign={{
          value: design,
          onChange: (next) => {
            onDesignChange(next);
            setDesign(next);
          },
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

function sectionButton(title: string) {
  const button = screen
    .getAllByRole("button")
    .find(
      (each) => each.hasAttribute("aria-expanded") && (each.textContent ?? "").startsWith(title),
    );
  if (!button) throw new Error(`No section called ${title}`);
  return button;
}

describe("Site styles in the right panel", () => {
  it("opens from Style with a selection, and Back returns to the element", async () => {
    const person = userEvent.setup();
    renderBuilder(ink);
    await select(person, "Second card");
    await person.click(screen.getByRole("button", { name: /^Site styles/ }));
    expect(screen.getByRole("heading", { name: "Site styles" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Ink/ })).toBeInTheDocument();
    await person.click(screen.getByRole("button", { name: "Style" }));
    expect(screen.queryByRole("heading", { name: "Site styles" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Site styles/ })).toBeInTheDocument();
  });

  it("offers starting points while a group is empty, and counts where a colour is used", async () => {
    const person = userEvent.setup();
    const { design } = renderBuilder();
    await person.click(screen.getByRole("button", { name: "Ink" }));
    expect(design().variables).toEqual([
      { id: "ink", name: "Ink", kind: "colour", value: "#1f2328" },
    ]);
    // The first card already uses var(--lintel-var-ink).
    expect(screen.getByRole("button", { name: /^Ink.*1 use/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("says a variable's name in a closed section's summary, not its code", async () => {
    const person = userEvent.setup();
    renderBuilder(ink);
    await select(person, "First card");
    const background = sectionButton("Background");
    if (background.getAttribute("aria-expanded") === "true") await person.click(background);
    expect(sectionButton("Background")).toHaveTextContent("BackgroundInk");
  });

  it("lists the site's colours before the theme's", async () => {
    const person = userEvent.setup();
    renderBuilder(ink);
    await select(person, "Second card");
    const background = sectionButton("Background");
    if (background.getAttribute("aria-expanded") !== "true") await person.click(background);
    const swatches = within(screen.getByRole("group", { name: "Background colour" })).getAllByRole(
      "button",
    );
    expect(swatches[0]).toHaveAccessibleName("Ink");
  });

  it("keeps the look of elements on this page when a used colour is deleted", async () => {
    const person = userEvent.setup();
    const { node, design } = renderBuilder(ink);
    await person.click(screen.getByRole("button", { name: /^Ink/ }));
    await person.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("alert")).toHaveTextContent("used 1 times on this page");
    await person.click(within(screen.getByRole("alert")).getByRole("button", { name: "Delete" }));
    expect(design().variables).toEqual([]);
    expect(node("First card")?.styles.base.backgroundColor).toBe("#1f2328");
  });

  it("gives a colour a dark-mode value, and takes it off again", async () => {
    const person = userEvent.setup();
    const { design } = renderBuilder(ink);
    await person.click(screen.getByRole("button", { name: /^Ink/ }));
    await person.click(screen.getByRole("button", { name: "Add a dark-mode colour" }));
    expect(design().variables[0]?.darkValue).toMatch(/^#[0-9a-f]{6}$/);
    const dark = screen.getByRole("textbox", { name: "Ink: In dark mode" });
    await person.clear(dark);
    await person.type(dark, "#e6e1d8{Enter}");
    expect(design().variables[0]).toMatchObject({ value: "#1f2328", darkValue: "#e6e1d8" });
    await person.click(screen.getByRole("button", { name: "Use the same colour in dark mode" }));
    expect(design().variables[0]).toEqual({
      id: "ink",
      name: "Ink",
      kind: "colour",
      value: "#1f2328",
    });
  });

  it("makes a variant that follows its base, and switches between them", async () => {
    const person = userEvent.setup();
    const withCard: SiteDesign = {
      variables: [],
      sharedStyles: [
        {
          id: "card",
          name: "Card",
          styles: { base: { backgroundColor: "#ffffff", borderRadius: "8px" } },
        },
      ],
    };
    const { node, design } = renderBuilder(withCard);
    await select(person, "Second card");
    await person.click(screen.getByRole("button", { name: /^No shared style/ }));
    await person.click(screen.getByRole("button", { name: "Card" }));
    expect(screen.getByText("1 on this page")).toBeInTheDocument();

    await person.click(screen.getByRole("button", { name: "Make a variant" }));
    await person.type(screen.getByRole("textbox", { name: "Name for the variant" }), "Dark{Enter}");
    expect(design().sharedStyles[1]).toEqual({
      id: "card-dark",
      name: "Dark",
      variantOf: "card",
      styles: { base: {} },
    });
    expect(node("Second card")?.sharedStyle).toBe("card-dark");

    // Changes now go to the variant: the base keeps its own look.
    const background = sectionButton("Background");
    if (background.getAttribute("aria-expanded") !== "true") await person.click(background);
    const swatches = within(screen.getByRole("group", { name: "Background colour" }));
    await person.click(swatches.getAllByRole("button")[0]!);
    expect(design().sharedStyles[1]?.styles.base.backgroundColor).toBeDefined();
    expect(design().sharedStyles[0]?.styles.base.backgroundColor).toBe("#ffffff");

    await person.click(screen.getByRole("radio", { name: "Main" }));
    expect(node("Second card")?.sharedStyle).toBe("card");
  });

  it("selects the elements using a shared style, and detaches them when it's deleted", async () => {
    const person = userEvent.setup();
    const ids = createCountingNodeIds();
    const cards = createNode(
      {
        type: "section",
        name: "Cards",
        children: [
          { type: "box", name: "First card" },
          { type: "box", name: "Second card" },
        ],
      },
      standardCatalogue,
      ids,
    );
    cards.children = cards.children.map((child) => ({ ...child, sharedStyle: "card" }));
    const { node, design } = renderBuilder(
      {
        variables: [],
        sharedStyles: [{ id: "card", name: "Card", styles: { base: { borderRadius: "8px" } } }],
      },
      [cards],
    );
    await person.click(screen.getByRole("button", { name: /^Card\s*2 on this page/ }));
    await person.click(screen.getByRole("button", { name: "Select them" }));
    expect(
      within(screen.getByRole("tree")).getByRole("treeitem", { name: "First card" }),
    ).toHaveAttribute("aria-selected", "true");

    await person.click(screen.getByRole("button", { name: /^Site styles/ }));
    await person.click(screen.getByRole("button", { name: /^Card\s*2 on this page/ }));
    await person.click(screen.getByRole("button", { name: "Delete" }));
    await person.click(within(screen.getByRole("alert")).getByRole("button", { name: "Delete" }));
    expect(design().sharedStyles).toEqual([]);
    expect(node("First card")).not.toHaveProperty("sharedStyle");
    expect(node("Second card")?.styles.base.borderRadius).toBe("8px");
  });

  it("sets how every heading looks, and how every link looks while hovered", async () => {
    const person = userEvent.setup();
    const { design } = renderBuilder(ink);
    await person.click(screen.getByRole("button", { name: /^All headings/ }));
    expect(screen.getByRole("heading", { name: "All headings" })).toBeInTheDocument();
    const size = screen.getByRole("group", { name: "Text size" });
    await person.click(within(size).getByRole("button", { name: "Huge" }));
    expect(design().tagStyles).toEqual({ headings: { base: { fontSize: "2rem" } } });

    await person.click(screen.getByRole("button", { name: "Site styles" }));
    expect(screen.getByRole("button", { name: /^All headings\s*Changed/ })).toBeInTheDocument();
    await person.click(screen.getByRole("button", { name: /^All links/ }));
    await person.click(screen.getByRole("radio", { name: "Hovered" }));
    const colour = screen.getByRole("group", { name: "Text colour" });
    await person.click(within(colour).getByRole("button", { name: "Ink" }));
    expect(design().tagStyles?.links).toEqual({
      base: {},
      hover: { color: "var(--lintel-var-ink)" },
    });
  });

  it("tells apart elements around it that have the same name", async () => {
    const person = userEvent.setup();
    const ids = createCountingNodeIds();
    const nested = createNode(
      {
        type: "section",
        name: "Hero",
        children: [
          {
            type: "card",
            children: [
              {
                type: "container",
                children: [{ type: "card", children: [{ type: "heading", name: "Title" }] }],
              },
            ],
          },
        ],
      },
      standardCatalogue,
      ids,
    );
    renderBuilder(emptySiteDesign, [nested]);
    await select(person, "Title");
    await person.click(screen.getByRole("radio", { name: "Hovered" }));
    await person.click(
      screen.getByRole("button", { name: "Change it when something around it is hovered…" }),
    );
    for (const name of ["Card, just around it", "Card, 2 levels up", "Hero, around it"]) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    }
    // The plain container between the cards isn't offered.
    expect(screen.queryByRole("radio", { name: /^Container/ })).toBeNull();
  });
});

describe("Site styles for beginners (QA sweep)", () => {
  it("shows colours as swatches, without their codes, and calls the side space plainly", async () => {
    const person = userEvent.setup();
    renderBuilder(
      { ...ink, variables: [{ ...ink.variables[0]!, darkValue: "#e6e1d8" }] },
      undefined,
      "beginner",
    );
    const row = screen.getByRole("button", { name: /^Ink/ });
    expect(row).not.toHaveTextContent("#1f2328");
    await person.click(row);
    expect(screen.getByLabelText("Ink: Value (Colour)")).toBeInTheDocument();
    const code = document.querySelector<HTMLInputElement>('input[aria-label="Ink: Value"]');
    expect(code).not.toBeNull();
    expect(code).not.toBeVisible();
    expect(screen.getByText("In light mode")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Side space" })).toBeInTheDocument();
  });

  it("still shows the codes in Designer", () => {
    renderBuilder(ink);
    expect(screen.getByRole("button", { name: /^Ink/ })).toHaveTextContent("#1f2328");
  });
});
