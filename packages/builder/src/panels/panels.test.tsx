import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  findNode,
  type NodeBlueprint,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { picturePreviewSrc } from "./content-fields.js";
import { PageBuilder } from "../PageBuilder.js";
import {
  createMemoryPreferenceStore,
  type PreferenceStore,
} from "../preferences/builder-preferences.js";
import { simpleHero } from "../testing/simple-hero.js";

function pageWith(...blueprints: NodeBlueprint[]): PageDocument {
  const page = createEmptyPage();
  const ids = createCountingNodeIds();
  const children = blueprints.map((blueprint) => createNode(blueprint, standardCatalogue, ids));
  return { ...page, root: { ...page.root, children } };
}

function renderBuilder(
  document: PageDocument = pageWith(simpleHero),
  preferences: PreferenceStore = createMemoryPreferenceStore({ tourSeen: "yes" }),
) {
  const onChange = vi.fn<(document: PageDocument) => void>();
  const view = render(
    <PageBuilder
      initialDocument={document}
      onChange={onChange}
      title="Home"
      canEditCode={false}
      createId={createCountingNodeIds("new")}
      preferences={preferences}
    />,
  );
  const latest = () => onChange.mock.lastCall?.[0] as PageDocument;
  return { latest, preferences, unmount: view.unmount };
}

const user = () => userEvent.setup();

async function select(person: ReturnType<typeof user>, name: string) {
  await person.click(within(screen.getByRole("tree")).getByRole("treeitem", { name }));
}

/** A collapsible group's heading button, found by its title (its name also has the summary). */
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

function groupOf(title: string): HTMLElement {
  return disclosure(title).closest("section") as HTMLElement;
}

describe("the Insert panel", () => {
  it("opens on ready-made sections, in closed groups by purpose with their counts", async () => {
    const person = user();
    const { preferences } = renderBuilder();
    await person.click(screen.getByRole("tab", { name: "Insert" }));

    expect(screen.getByRole("radio", { name: "Sections" })).toBeChecked();
    const groups = within(screen.getByRole("complementary", { name: "Page structure" }))
      .getAllByRole("button")
      .filter(
        (button) => button.hasAttribute("aria-expanded") && !button.hasAttribute("aria-haspopup"),
      );
    expect(groups.map((group) => group.getAttribute("aria-expanded"))).toEqual(
      groups.map(() => "false"),
    );
    expect(groups.map((group) => group.textContent)).toEqual([
      "Navigation5",
      "Intro and banners12",
      "Features and steps6",
      "About and story4",
      "Pictures and galleries4",
      "Reviews and proof9",
      "Pricing3",
      "Questions3",
      "Contact and booking7",
      "Shop2",
      "Footer8",
    ]);
    // Each category has a picture beside its name, hidden from screen readers.
    for (const group of groups) {
      expect(group.querySelectorAll("svg[aria-hidden='true']")).toHaveLength(2);
    }
    expect(screen.queryByRole("button", { name: "Hero" })).not.toBeInTheDocument();

    await person.click(disclosure("Intro and banners"));
    const hero = screen.getByRole("button", { name: "Hero" });
    expect(hero).toHaveAccessibleDescription(/A big welcome at the top of the page/);
    // A section shows what it's for in the list, under a sketch of it, since beginners choose
    // sections by purpose; the tile's name stays its own.
    expect(hero).toHaveTextContent(/A big welcome at the top of the page/);
    expect(hero).toHaveAccessibleName("Hero");
    expect(preferences.read("insert.sectionGroups.open")).toBe("intro");
  });

  it("finds sections for a kind of business by search, under neutral names", async () => {
    const person = user();
    renderBuilder();
    await person.click(screen.getByRole("tab", { name: "Insert" }));
    await person.type(
      screen.getByRole("searchbox", { name: "Search sections and elements" }),
      "bakery",
    );
    const sections = screen.getByRole("region", { name: "Sections" });
    expect(within(sections).getByRole("button", { name: "Opening times" })).toBeInTheDocument();
    expect(
      within(sections).getByRole("button", { name: "Pictures with prices" }),
    ).toBeInTheDocument();
  });

  it("inserts elements from a compact grid and keeps them under Recently used", async () => {
    const person = user();
    const { latest, preferences } = renderBuilder();
    await person.click(screen.getByRole("tab", { name: "Insert" }));
    await person.click(screen.getByRole("radio", { name: "Elements" }));
    expect(preferences.read("insert.kind")).toBe("elements");

    await person.click(disclosure("Text"));
    await person.click(screen.getByRole("button", { name: "Quote" }));
    expect(latest().root.children.at(-1)?.type).toBe("quote");

    const recent = screen.getByRole("region", { name: "Recently used" });
    expect(within(recent).getByRole("button", { name: "Quote" })).toBeInTheDocument();
    expect(preferences.read("insert.recent")).toBe("component:quote");
  });

  it("searches sections and elements together", async () => {
    const person = user();
    renderBuilder();
    await person.click(screen.getByRole("tab", { name: "Insert" }));
    const search = screen.getByRole("searchbox", { name: "Search sections and elements" });

    await person.type(search, "quote");
    expect(screen.queryByRole("radio", { name: "Sections" })).not.toBeInTheDocument();
    const elements = screen.getByRole("region", { name: "Elements" });
    const sections = screen.getByRole("region", { name: "Sections" });
    expect(within(elements).getByRole("button", { name: "Quote" })).toBeInTheDocument();
    expect(within(sections).getByRole("button", { name: "Customer quote" })).toBeInTheDocument();

    await person.keyboard("{ArrowDown}");
    expect(within(elements).getByRole("button", { name: "Quote" })).toHaveFocus();

    await person.clear(search);
    await person.type(search, "spaceship");
    expect(
      screen.getByText(/Nothing matches “spaceship”/, { selector: "p:not(.sr-only)" }),
    ).toBeInTheDocument();
    await person.keyboard("{Escape}");
    expect(search).toHaveValue("");
    expect(screen.getByRole("radio", { name: "Sections" })).toBeInTheDocument();
  });

  it("explains an item in a details popover that closes with Escape", async () => {
    const person = user();
    const { latest } = renderBuilder();
    await person.click(screen.getByRole("tab", { name: "Insert" }));
    await person.click(disclosure("Intro and banners"));
    const about = screen.getByRole("button", { name: "About Hero" });

    await person.click(about);
    expect(about).toHaveAttribute("aria-expanded", "true");
    const details = screen.getByRole("dialog", { name: "Hero" });
    expect(details).toHaveTextContent(/A big welcome at the top of the page/);
    expect(within(details).getByRole("button", { name: "Insert Hero" })).toHaveFocus();

    await person.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Hero" })).not.toBeInTheDocument();
    expect(about).toHaveFocus();

    await person.click(about);
    await person.click(screen.getByRole("button", { name: "Insert Hero" }));
    expect(latest().root.children).toHaveLength(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("the Style panel's groups", () => {
  it("opens the most used groups in Simple, says what's set in the others, and remembers", async () => {
    const person = user();
    const preferences = createMemoryPreferenceStore({ tourSeen: "yes" });
    const { unmount } = renderBuilder(pageWith(simpleHero), preferences);
    await select(person, "Hero title");

    expect(disclosure("Spacing")).toHaveAttribute("aria-expanded", "true");
    expect(disclosure("Text")).toHaveAttribute("aria-expanded", "true");
    const background = disclosure("Background");
    expect(background).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("group", { name: "Background colour" })).not.toBeInTheDocument();

    await person.click(background);
    await person.click(within(groupOf("Background")).getByRole("button", { name: "Brand" }));
    await person.click(disclosure("Text"));
    expect(disclosure("Text")).toHaveAttribute("aria-expanded", "false");
    await person.click(disclosure("Background"));
    expect(disclosure("Background")).toHaveTextContent("Brand");

    unmount();
    renderBuilder(pageWith(simpleHero), preferences);
    await select(person, "Hero title");
    expect(disclosure("Text")).toHaveAttribute("aria-expanded", "false");
    expect(disclosure("Spacing")).toHaveAttribute("aria-expanded", "true");
  });

  it("summarises a closed layout group as it reads: One under another · gap L", async () => {
    const person = user();
    renderBuilder();
    await select(person, "Container");
    await person.click(disclosure("Layout"));
    expect(disclosure("Layout")).toHaveTextContent("One under another · gap L");
  });

  it("opens only the group used last in Advanced", async () => {
    const person = user();
    const { preferences, unmount } = renderBuilder();
    await select(person, "Hero title");
    await person.click(screen.getByRole("radio", { name: "Advanced" }));
    for (const name of ["Spacing", "Size", "Text", "Background", "Effects"]) {
      expect(disclosure(name)).toHaveAttribute("aria-expanded", "false");
    }
    await person.click(disclosure("Effects"));
    expect(preferences.read("style.advanced.lastUsed")).toBe("effects");

    unmount();
    renderBuilder(pageWith(simpleHero), preferences);
    await select(person, "Hero title");
    await person.click(screen.getByRole("radio", { name: "Advanced" }));
    expect(disclosure("Effects")).toHaveAttribute("aria-expanded", "true");
    expect(disclosure("Text")).toHaveAttribute("aria-expanded", "false");
  });

  it("chooses the look to change, in plain words", async () => {
    const person = user();
    const { latest } = renderBuilder();
    await select(person, "Button");
    await person.click(screen.getByRole("radio", { name: "Advanced" }));
    const looks = screen.getByRole("radiogroup", { name: "Which look you're changing" });
    expect(
      within(looks)
        .getAllByRole("radio")
        .map((look) => look.textContent),
    ).toEqual(["Normal", "Hovered", "Pressed", "Focused", "Open", "Current"]);
    await person.click(within(looks).getByRole("radio", { name: "Hovered" }));
    expect(screen.getByText(/while a mouse pointer is over it/)).toBeInTheDocument();
    await person.click(disclosure("Background"));
    await person.click(within(groupOf("Background")).getByRole("button", { name: "Accent" }));
    expect(findNode(latest().root, "n5")?.styles.hover?.backgroundColor).toBe(
      "var(--lintel-color-accent)",
    );
  });

  it("offers Open and Current only where they mean something, until Advanced", async () => {
    const person = user();
    renderBuilder();
    const lookNames = () =>
      within(screen.getByRole("radiogroup", { name: "Which look you're changing" }))
        .getAllByRole("radio")
        .map((look) => look.textContent);
    await select(person, "Hero title");
    expect(lookNames()).toEqual(["Normal", "Hovered", "Pressed", "Focused"]);
    await select(person, "Button");
    expect(lookNames()).toEqual(["Normal", "Hovered", "Pressed", "Focused", "Open"]);
    await person.click(screen.getByRole("radio", { name: "Advanced" }));
    expect(lookNames()).toEqual(["Normal", "Hovered", "Pressed", "Focused", "Open", "Current"]);
  });

  // States: the button can follow the state of what's around it, and both ease together.
  it("styles an element for the hover of what's around it, and sets how they move", async () => {
    const person = user();
    const { latest } = renderBuilder();
    await select(person, "Button");
    // Nothing to answer about whose look until a look other than Normal is chosen.
    expect(screen.queryByRole("radiogroup", { name: /What has to be/ })).toBeNull();
    const looks = screen.getByRole("radiogroup", { name: "Which look you're changing" });
    await person.click(within(looks).getByRole("radio", { name: "Hovered" }));
    // Most people mean the element itself, so what's around it waits behind a link.
    expect(screen.queryByRole("radiogroup", { name: /What has to be/ })).toBeNull();
    await person.click(
      screen.getByRole("button", { name: "Change it when something around it is hovered…" }),
    );
    const whose = screen.getByRole("radiogroup", { name: "What has to be hovered" });
    expect(within(whose).getByRole("radio", { name: "This element" })).toBeChecked();
    // Only things people recognise are offered: no plain layout boxes.
    expect(within(whose).queryByRole("radio", { name: /^Container/ })).toBeNull();
    const ownerChoice = within(whose)
      .getAllByRole("radio")
      .find((choice) => choice.textContent?.endsWith(", around it"));
    expect(ownerChoice).toBeDefined();
    await person.click(ownerChoice!);
    expect(screen.getByText(/while the pointer is over/)).toBeInTheDocument();

    // Keyboard focus is the element's own, so there's no second question for it.
    await person.click(within(looks).getByRole("radio", { name: "Focused" }));
    expect(screen.queryByRole("radiogroup", { name: /What has to be/ })).toBeNull();
    await person.click(within(looks).getByRole("radio", { name: "Open" }));
    await person.click(
      within(screen.getByRole("radiogroup", { name: "What has to be open" })).getAllByRole(
        "radio",
      )[1]!,
    );
    await person.click(within(looks).getByRole("radio", { name: "Hovered" }));
    // Moving between looks keeps following the same element around it.
    expect(
      within(screen.getByRole("radiogroup", { name: "What has to be hovered" })).getAllByRole(
        "radio",
      )[1],
    ).toBeChecked();
    const ownerName = ownerChoice!.textContent!.replace(", around it", "");
    expect(screen.getByText(/while the pointer is over/)).toHaveTextContent(ownerName);

    await person.click(disclosure("Background"));
    await person.click(within(groupOf("Background")).getByRole("button", { name: "Accent" }));
    const [target] = Object.keys(findNode(latest().root, "n5")?.styles.owners ?? {});
    expect(target).toMatch(/^hover@/);
    expect(findNode(latest().root, "n5")?.styles.owners?.[target as `hover@${string}`]).toEqual({
      backgroundColor: "var(--lintel-color-accent)",
    });
    const ownerId = target!.split("@")[1]!;

    // Instant until a feel is chosen; the transition is saved on the owner.
    expect(screen.getByRole("radio", { name: "Instant" })).toBeChecked();
    await person.click(screen.getByRole("radio", { name: "Springy" }));
    expect(findNode(latest().root, ownerId)?.stateTransition).toEqual({
      feel: "springy",
      speed: "steady",
    });
    await person.click(screen.getByRole("radio", { name: "Quick" }));
    expect(findNode(latest().root, ownerId)?.stateTransition?.speed).toBe("quick");
  });

  it("still opens groups on a locked element, with the controls disabled", async () => {
    const person = user();
    renderBuilder();
    await person.click(
      within(screen.getByRole("tree")).getByRole("button", { name: "Lock Hero title" }),
    );
    await select(person, "Hero title, locked");
    await person.click(disclosure("Background"));
    expect(disclosure("Background")).toHaveAttribute("aria-expanded", "true");
    expect(within(groupOf("Background")).getByRole("button", { name: "Brand" })).toBeDisabled();
  });
});

describe("collapsible Content and Animate groups", () => {
  it("groups a block with many fields, with the words open first", async () => {
    const person = user();
    const { latest } = renderBuilder(
      pageWith({ type: "heroBlock", name: "Welcome", props: { heading: "Fresh bread" } }),
    );
    await select(person, "Welcome");
    await person.click(screen.getByRole("tab", { name: "Content" }));

    expect(disclosure("Words")).toHaveAttribute("aria-expanded", "true");
    expect(disclosure("Picture")).toHaveAttribute("aria-expanded", "true");
    const options = disclosure("Options");
    expect(options).toHaveAttribute("aria-expanded", "false");
    expect(options).toHaveTextContent("This is the page’s main title: on");
    expect(disclosure("Link")).toHaveTextContent("/contact");
    await person.click(options);
    await person.click(screen.getByRole("switch", { name: /main title/ }));
    await person.click(options);
    expect(options).toHaveTextContent(/^Options$/);
    expect(findNode(latest().root, "n1")?.props.isPageTitle).toBe(false);
  });

  it("shows a short element's few fields together", async () => {
    const person = user();
    renderBuilder();
    await select(person, "Button");
    await person.click(screen.getByRole("tab", { name: "Content" }));
    expect(screen.getByRole("textbox", { name: "Words on the button" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Words/ })).not.toBeInTheDocument();
  });

  it("folds away the less used animation settings", async () => {
    const person = user();
    const { preferences } = renderBuilder();
    await select(person, "Hero title");
    await person.click(screen.getByRole("tab", { name: "Animate" }));
    await person.click(screen.getByRole("button", { name: "Add motion" }));
    await person.click(screen.getByRole("radio", { name: "Appears" }));
    await person.click(screen.getByRole("button", { name: "More settings" }));

    expect(disclosure("When it plays")).toHaveAttribute("aria-expanded", "true");
    expect(disclosure("Speed and timing")).toHaveAttribute("aria-expanded", "true");
    const reduced = disclosure("For less motion");
    expect(reduced).toHaveAttribute("aria-expanded", "false");
    expect(reduced).toHaveTextContent("Just fade");
    await person.click(reduced);
    expect(
      screen.getByRole("combobox", { name: /For people who prefer less motion|less motion/i }),
    ).toBeInTheDocument();
    expect(preferences.read("animate.open")).toBe("trigger,timing,reducedMotion");
  });
});

describe("a picture's Content (QA sweep)", () => {
  it("says Picture once, and shows a built-in illustration without its path", async () => {
    const person = user();
    renderBuilder(
      pageWith({
        type: "image",
        name: "Photo",
        props: { src: "/_lintel/illustrations/abstract-hills.svg" },
      }),
    );
    await select(person, "Photo");
    await person.click(screen.getByRole("tab", { name: "Content" }));

    expect(disclosure("Picture")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Picture" })).toBeNull();
    expect(screen.getByText(/A built-in illustration/)).toBeInTheDocument();
    expect(
      screen.queryByDisplayValue("/_lintel/illustrations/abstract-hills.svg"),
    ).not.toBeVisible();
  });

  it("loads a built-in illustration from the website's address", () => {
    expect(picturePreviewSrc("/_lintel/illustrations/hills.svg", "http://localhost:4000/")).toBe(
      "http://localhost:4000/_lintel/illustrations/hills.svg",
    );
    expect(picturePreviewSrc("/media/photo.jpg", "http://localhost:4000")).toBe("/media/photo.jpg");
    expect(picturePreviewSrc("/_lintel/illustrations/hills.svg", null)).toBe(
      "/_lintel/illustrations/hills.svg",
    );
  });
});

describe("Style chips that match the real look (QA sweep)", () => {
  it("presses Bold for a 600 button and 2 for a grid of 1fr 1fr", async () => {
    const person = user();
    renderBuilder(
      pageWith(
        { type: "button", name: "Go", styles: { base: { fontWeight: "600" } } },
        {
          type: "box",
          name: "Pair",
          styles: { base: { display: "grid", gridTemplateColumns: "1fr 1fr" } },
        },
      ),
    );
    await select(person, "Go");
    const weight = screen.getByRole("group", { name: "Weight" });
    expect(within(weight).getByRole("button", { name: "Bold" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(weight).queryByText("Custom")).toBeNull();
    await select(person, "Pair");
    const columns = screen.getByRole("radiogroup", { name: "Columns" });
    expect(within(columns).getByRole("radio", { name: "2" })).toBeChecked();
  });

  it("presses the chips the canvas measures when nothing is set: Normal size, 3 columns", async () => {
    const person = user();
    renderBuilder(
      pageWith(
        { type: "button", name: "Go" },
        { type: "box", name: "Trio", styles: { base: { display: "grid" } } },
      ),
    );
    const measured = (nodeId: string, gridColumns: number) =>
      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            source: document.querySelector("iframe")!.contentWindow,
            data: {
              type: "look",
              nodeId,
              textAlign: "start",
              fontSize: 17,
              fontWeight: "600",
              color: "rgb(0, 0, 0)",
              gridColumns,
            },
          }),
        );
      });
    await select(person, "Go");
    measured("n1", 0);
    const size = screen.getByRole("group", { name: "Text size" });
    expect(within(size).getByRole("button", { name: "Normal" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await select(person, "Trio");
    measured("n2", 3);
    const columns = screen.getByRole("radiogroup", { name: "Columns" });
    expect(within(columns).getByRole("radio", { name: "3" })).toBeChecked();
  });
});
