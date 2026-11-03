import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  findNode,
  type NodeBlueprint,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PageBuilder } from "../PageBuilder.js";
import { createMemoryPreferenceStore } from "../preferences/builder-preferences.js";

const poster: NodeBlueprint = {
  type: "section",
  name: "Poster",
  children: [
    { type: "heading", name: "Big word", props: { text: "FREEDOM", level: 1 } },
    { type: "image", name: "Photo", props: { src: "/media/photo.jpg", alt: "A person" } },
  ],
};

function renderBuilder(section: NodeBlueprint = poster) {
  const page = createEmptyPage();
  const ids = createCountingNodeIds();
  const document: PageDocument = {
    ...page,
    root: { ...page.root, children: [createNode(section, standardCatalogue, ids)] },
  };
  const onChange = vi.fn<(document: PageDocument) => void>();
  const pickImage = vi.fn(async () => ({ assetId: "a1", src: "/media/field.jpg", alt: "" }));
  render(
    <PageBuilder
      initialDocument={document}
      onChange={onChange}
      title="Home"
      canEditCode={false}
      createId={createCountingNodeIds("new")}
      pickImage={pickImage}
      preferences={createMemoryPreferenceStore({ tourSeen: "yes" })}
    />,
  );
  const latest = () => onChange.mock.lastCall?.[0] as PageDocument;
  const node = (name: string) => {
    const found = latest().root.children[0];
    if (name === "Poster") return found;
    return found?.children.find((child) => child.name === name);
  };
  return { latest, node, pickImage };
}

async function select(person: ReturnType<typeof userEvent.setup>, name: string) {
  await person.click(within(screen.getByRole("tree")).getByRole("treeitem", { name }));
}

function disclosure(title: string): HTMLElement {
  const found = screen
    .getAllByRole("button")
    .find(
      (button) =>
        button.hasAttribute("aria-expanded") &&
        !button.hasAttribute("aria-haspopup") &&
        (button.textContent ?? "").startsWith(title),
    );
  if (!found) throw new Error(`No collapsible group called ${title}`);
  return found;
}

async function open(person: ReturnType<typeof userEvent.setup>, title: string) {
  const button = disclosure(title);
  if (button.getAttribute("aria-expanded") !== "true") await person.click(button);
  return button.closest("section") as HTMLElement;
}

describe("advanced styling in the Style panel", () => {
  // A size set elsewhere that no chip matches showed as "1.125rem" with no chip pressed.
  it("shows a size no chip matches as Custom, in pixels", async () => {
    const person = userEvent.setup();
    renderBuilder({
      type: "section",
      name: "Intro",
      children: [
        {
          type: "text",
          name: "Lead",
          props: { text: "Fresh every morning." },
          styles: { base: { fontSize: "1.125rem" } },
        },
      ],
    });
    await select(person, "Lead");
    const group = await open(person, "Text");
    expect(within(group).getByText("Custom · 18px")).toBeInTheDocument();
    for (const size of ["Normal", "Small", "Large", "Huge", "Giant"]) {
      expect(within(group).getByRole("button", { name: size })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
    await person.click(within(group).getByRole("button", { name: "Large" }));
    expect(within(group).queryByText(/^Custom · /)).toBeNull();
    expect(within(group).getByRole("button", { name: "Large" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("turns and resizes in Simple, and slants in Advanced, per screen size", async () => {
    const person = userEvent.setup();
    const { node } = renderBuilder();
    await select(person, "Photo");
    const group = await open(person, "Move and turn");
    fireEvent.change(within(group).getByLabelText("Turn"), { target: { value: "-12" } });
    expect(node("Photo")?.styles.base.rotate).toBe("-12deg");
    expect(within(group).queryByLabelText("Slant sideways")).toBeNull();

    await person.click(screen.getByRole("radio", { name: "Advanced" }));
    const advanced = await open(person, "Move and turn");
    fireEvent.change(within(advanced).getByLabelText("Slant sideways"), {
      target: { value: "-8" },
    });
    expect(node("Photo")?.styles.base.transform).toBe("skew(-8deg, 0deg)");

    await person.click(screen.getByRole("radio", { name: "Phone" }));
    fireEvent.change(within(await open(person, "Move and turn")).getByLabelText("Turn"), {
      target: { value: "0" },
    });
    // Back at zero on phones is "not set" there, so phones keep desktop's turn.
    expect(node("Photo")?.styles.phone?.rotate).toBeUndefined();
  });

  it("cuts to a ready-made shape, or a polygon with corners to move", async () => {
    const person = userEvent.setup();
    const { node } = renderBuilder();
    await select(person, "Photo");
    const group = await open(person, "Shape and mask");
    await person.click(within(group).getByRole("button", { name: "Circle" }));
    expect(node("Photo")?.styles.base.clipPath).toBe("circle(50% at 50% 50%)");
    await person.click(within(group).getByRole("button", { name: "Your own" }));
    expect(node("Photo")?.styles.base.clipPath).toBe("polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)");
    const corner = within(group).getByRole("button", { name: /Corner 3 of 4/ });
    corner.focus();
    await person.keyboard("{Shift>}{ArrowUp}{/Shift}");
    expect(node("Photo")?.styles.base.clipPath).toBe("polygon(0% 0%, 100% 0%, 100% 90%, 0% 100%)");
  });

  it("adds a picture with a focal point and darkens it, in Simple", async () => {
    const person = userEvent.setup();
    const { node, pickImage } = renderBuilder();
    await select(person, "Poster");
    const group = await open(person, "Background");
    await person.click(within(group).getByRole("button", { name: "Add a picture" }));
    expect(pickImage).toHaveBeenCalled();
    expect(node("Poster")?.styles.base.backgroundImage).toBe('url("/media/field.jpg")');
    const focal = within(group).getByRole("slider", { name: "The part to keep in view" });
    focal.focus();
    await person.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(node("Poster")?.styles.base.backgroundPosition).toBe("60% 50%");
    await person.click(within(group).getByRole("button", { name: "Some" }));
    expect(node("Poster")?.styles.base.backgroundImage).toBe(
      'linear-gradient(180deg, rgb(0 0 0 / 0.4) 0%, rgb(0 0 0 / 0.4) 100%), url("/media/field.jpg")',
    );
  });

  it("fills text with a gradient in Advanced", async () => {
    const person = userEvent.setup();
    const { node } = renderBuilder();
    await select(person, "Big word");
    await person.click(screen.getByRole("radio", { name: "Advanced" }));
    const group = await open(person, "Background");
    await person.click(within(group).getByRole("button", { name: "Add a gradient" }));
    await person.click(
      within(group).getByRole("checkbox", { name: "Show the background through the text" }),
    );
    expect(node("Big word")?.styles.base).toMatchObject({
      backgroundImage: "linear-gradient(180deg, #7539fd 0%, #f7c948 100%)",
      backgroundClip: "text",
      color: "transparent",
    });
  });

  it("offers a ready-made look in Simple and every filter in Advanced", async () => {
    const person = userEvent.setup();
    const { node } = renderBuilder();
    await select(person, "Photo");
    const group = await open(person, "Blend and filters");
    await person.click(within(group).getByRole("button", { name: "Black and white" }));
    expect(node("Photo")?.styles.base.filter).toBe("grayscale(100%)");
    expect(within(group).queryByLabelText("Blur")).toBeNull();
    await person.click(screen.getByRole("radio", { name: "Advanced" }));
    const advanced = await open(person, "Blend and filters");
    fireEvent.change(within(advanced).getByLabelText("Blur"), { target: { value: "4" } });
    expect(node("Photo")?.styles.base.filter).toBe("blur(4px) grayscale(100%)");
    await person.selectOptions(
      within(advanced).getByLabelText("Blend with what’s behind"),
      "multiply",
    );
    expect(node("Photo")?.styles.base.mixBlendMode).toBe("multiply");
  });

  it("adds a bundled font to the page and sizes text with the screen", async () => {
    const person = userEvent.setup();
    const { latest, node } = renderBuilder();
    await select(person, "Big word");
    const group = await open(person, "Text");
    // The fonts that come with Lintel are in the list; no "Add a font" without a host for it.
    expect(within(group).queryByRole("button", { name: "Add a font" })).toBeNull();
    await person.selectOptions(
      within(group).getByRole("combobox", { name: "Font" }),
      "'Bebas Neue', Impact, 'Arial Narrow', sans-serif",
    );
    expect(latest().root.props.fonts).toEqual([{ source: "catalogue", id: "bebas-neue" }]);
    expect(node("Big word")?.styles.base.fontFamily).toBe(
      "'Bebas Neue', Impact, 'Arial Narrow', sans-serif",
    );
    // Sizes in pixels that grow with the screen are for designers, not beginners.
    expect(within(group).queryByRole("checkbox", { name: "Grow with the screen" })).toBeNull();
    await person.click(within(group).getByRole("button", { name: "Thick" }));
    expect(node("Big word")?.styles.base).toMatchObject({
      textStroke: "2px currentColor",
      textFillColor: "transparent",
    });
  });

  it("sizes text with the screen, in Advanced", async () => {
    const person = userEvent.setup();
    const { node } = renderBuilder();
    await select(person, "Big word");
    await person.click(screen.getByRole("radio", { name: "Advanced" }));
    const group = await open(person, "Text");
    await person.click(within(group).getByRole("checkbox", { name: "Grow with the screen" }));
    expect(node("Big word")?.styles.base.fontSize).toBe("clamp(2rem, 1.26rem + 3.05vw, 4rem)");
  });

  it("switches a section to a free layout and stacks its children", async () => {
    const person = userEvent.setup();
    const { node } = renderBuilder();
    await select(person, "Poster");
    const group = await open(person, "Layout");
    await person.click(within(group).getByRole("radio", { name: "Anywhere" }));
    expect(node("Poster")?.freeLayout).toEqual({ stackOnPhone: true });
    expect(node("Poster")?.styles.base.minHeight).toBe("clamp(28rem, 60vw, 48rem)");
    expect(node("Big word")?.styles.base).toMatchObject({ left: "6%", top: "8%" });
    expect(node("Photo")?.styles.base).toMatchObject({ left: "14%", top: "20%" });

    await select(person, "Big word");
    const place = await open(person, "Where it sits");
    await person.click(within(place).getByRole("button", { name: "To the front" }));
    expect(node("Big word")?.styles.base.zIndex).toBe("2");
    expect(node("Photo")?.styles.base.zIndex).toBe("1");
    // Stacking never changes the reading order.
    expect(node("Poster")?.children.map((child) => child.name)).toEqual(["Big word", "Photo"]);
  });

  it("puts a section's elements on a grid and places one by columns and rows", async () => {
    const person = userEvent.setup();
    const { node } = renderBuilder();
    await select(person, "Poster");
    const group = await open(person, "Layout");
    await person.click(within(group).getByRole("radio", { name: "On a grid" }));
    expect(node("Poster")?.placedGrid).toBeUndefined();
    await person.click(
      within(group).getByRole("checkbox", { name: "Place each thing on the grid yourself" }),
    );
    expect(node("Poster")?.placedGrid).toEqual({ columns: 12, stackOnPhone: true });
    await person.click(within(group).getByRole("radio", { name: "8" }));
    expect(node("Poster")?.placedGrid?.columns).toBe(8);

    await select(person, "Photo");
    const place = await open(person, "Where it sits");
    // Not placed yet: the whole width, shown as columns 1 to 8.
    expect(within(place).getByRole("combobox", { name: "Last column" })).toHaveValue("8");
    await person.selectOptions(within(place).getByRole("combobox", { name: "First column" }), "2");
    expect(node("Photo")?.styles.base.gridColumn).toBe("2 / span 7");
    await person.selectOptions(within(place).getByRole("combobox", { name: "Last column" }), "5");
    expect(node("Photo")?.styles.base.gridColumn).toBe("2 / span 4");
    await person.selectOptions(within(place).getByRole("combobox", { name: "Last row" }), "3");
    expect(node("Photo")?.styles.base.gridRow).toBe("1 / span 3");
    expect(within(place).getByText("Exact values")).toBeInTheDocument();

    // Phones stack until the element is given a place of its own there.
    await person.click(screen.getByRole("radio", { name: "Phone" }));
    const onPhone = await open(person, "Where it sits");
    await person.click(within(onPhone).getByRole("button", { name: "Place it on phones too" }));
    expect(node("Photo")?.styles.phone).toMatchObject({
      gridColumn: "2 / span 4",
      gridRow: "1 / span 3",
    });
    await person.click(within(onPhone).getByRole("button", { name: "Back to one under another" }));
    expect(node("Photo")?.styles.phone).toBeUndefined();
  });

  it("styles selected words from the Content panel", async () => {
    const person = userEvent.setup();
    const { node } = renderBuilder();
    await select(person, "Big word");
    await person.click(screen.getByRole("tab", { name: "Content" }));
    const textBox = screen.getByRole("textbox", { name: "Text" }) as HTMLTextAreaElement;
    textBox.setSelectionRange(2, 4);
    fireEvent.select(textBox);
    await person.click(screen.getByRole("button", { name: "Italic" }));
    expect(node("Big word")?.props.marks).toEqual([
      { from: 2, to: 4, styles: { fontStyle: "italic" } },
    ]);
    expect(screen.getByRole("button", { name: "Italic" })).toHaveAttribute("aria-pressed", "true");
    await person.click(screen.getByRole("button", { name: "Clear styles" }));
    expect(node("Big word")?.props.marks).toBeUndefined();
  });
});

describe("the page after advanced styling", () => {
  it("keeps the document valid", async () => {
    const person = userEvent.setup();
    const { latest } = renderBuilder();
    await select(person, "Photo");
    await person.click(
      within(await open(person, "Shape and mask")).getByRole("button", { name: "Slash" }),
    );
    const photo = findNode(latest().root, latest().root.children[0]?.children[1]?.id ?? "");
    expect(photo?.styles.base.clipPath).toMatch(/^polygon/);
  });
});
