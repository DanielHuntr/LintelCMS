import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  findNode,
  type NodeBlueprint,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
  preferences: PreferenceStore = createMemoryPreferenceStore({
    tourSeen: "yes",
    skillLevel: "designer",
  }),
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
      "Intro and banners6",
      "Features and steps2",
      "About and story2",
      "Pictures and galleries2",
      "Reviews and proof3",
      "Pricing1",
      "Questions1",
      "Contact and booking4",
      "Shop2",
      "Footer-style2",
    ]);
    expect(screen.queryByRole("button", { name: "Hero" })).not.toBeInTheDocument();

    await person.click(disclosure("Intro and banners"));
    const hero = screen.getByRole("button", { name: "Hero" });
    expect(hero).toHaveAccessibleDescription(/A big welcome at the top of the page/);
    // Descriptions are in hover cards and details, not in the list.
    expect(
      screen.queryByText(/A big welcome at the top of the page/, { selector: "p" }),
    ).toBeNull();
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

  it("summarises a closed layout group as it reads: Stack · gap L", async () => {
    const person = user();
    renderBuilder();
    await select(person, "Container");
    await person.click(disclosure("Layout"));
    expect(disclosure("Layout")).toHaveTextContent("Stack · gap L");
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

  it("chooses the state to style from a dropdown", async () => {
    const person = user();
    const { latest } = renderBuilder();
    await select(person, "Button");
    await person.click(screen.getByRole("radio", { name: "Advanced" }));
    await person.selectOptions(screen.getByRole("combobox", { name: "Style for" }), "Pointer over");
    expect(screen.getByText(/apply only in this state/)).toBeInTheDocument();
    await person.click(disclosure("Background"));
    await person.click(within(groupOf("Background")).getByRole("button", { name: "Accent" }));
    expect(findNode(latest().root, "n5")?.styles.hover?.backgroundColor).toBe(
      "var(--lintel-color-accent)",
    );
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
    await person.click(screen.getByRole("button", { name: /^Fade up/ }));

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
