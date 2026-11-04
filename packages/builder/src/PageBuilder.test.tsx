import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  findNode,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PageBuilder } from "./PageBuilder.js";
import { createMemoryPreferenceStore } from "./preferences/builder-preferences.js";
import { simpleHero } from "./testing/simple-hero.js";

function heroPage(): PageDocument {
  const page = createEmptyPage();
  const hero = createNode(simpleHero, standardCatalogue, createCountingNodeIds());
  return { ...page, root: { ...page.root, children: [hero] } };
}

function renderBuilder(
  document: PageDocument,
  options: { canEditCode?: boolean; preferences?: Record<string, string> } = {},
) {
  const onChange = vi.fn<(document: PageDocument) => void>();
  render(
    <PageBuilder
      initialDocument={document}
      onChange={onChange}
      title="Home"
      canEditCode={options.canEditCode ?? false}
      createId={createCountingNodeIds("new")}
      preferences={createMemoryPreferenceStore(options.preferences ?? { tourSeen: "yes" })}
    />,
  );
  const latest = () => onChange.mock.lastCall?.[0] as PageDocument;
  return { onChange, latest };
}

describe("the page builder", () => {
  it("starts an empty page with a calm prompt and no gallery of sections", () => {
    renderBuilder(createEmptyPage());
    expect(screen.getByRole("heading", { name: "This page is empty" })).toHaveFocus();
    expect(
      screen.getByText("Start building by adding a section, or design your own with elements."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Three features/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Start your page/)).not.toBeInTheDocument();
  });

  it("opens Insert on Sections with the search focused, then adds a section", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder(createEmptyPage(), {
      preferences: { tourSeen: "yes", "insert.kind": "elements" },
    });
    await user.click(screen.getByRole("button", { name: "Add a section" }));
    expect(screen.getByRole("tab", { name: "Insert", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Sections" })).toBeChecked();
    expect(screen.getByRole("searchbox", { name: "Search sections and elements" })).toHaveFocus();
    await user.keyboard("three features");
    await user.click(screen.getByRole("button", { name: "Three features" }));
    expect(latest().root.children[0]?.name).toBe("Features");
    const announcements = screen.getAllByRole("status").map((status) => status.textContent);
    expect(announcements.join(" ")).toContain("Added Features");
    expect(screen.queryByRole("heading", { name: "This page is empty" })).not.toBeInTheDocument();
  });

  it("opens Insert on Elements with the search focused", async () => {
    const user = userEvent.setup();
    renderBuilder(createEmptyPage());
    await user.click(screen.getByRole("button", { name: "Add elements" }));
    expect(screen.getByRole("radio", { name: "Elements" })).toBeChecked();
    const search = screen.getByRole("searchbox", { name: "Search sections and elements" });
    expect(search).toHaveFocus();
    // Asking again, after moving away, focuses the search again.
    await user.click(screen.getByRole("radio", { name: "Sections" }));
    await user.click(screen.getByRole("button", { name: "Add elements" }));
    expect(screen.getByRole("radio", { name: "Elements" })).toBeChecked();
    expect(search).toHaveFocus();
  });

  it("moves through layers with the keyboard and nudges with Alt and the arrows", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder(heroPage());
    const tree = screen.getByRole("tree", { name: "Layers" });
    await user.click(within(tree).getByRole("treeitem", { name: "Hero title" }));
    await user.keyboard("{ArrowDown}");
    const paragraph = within(tree).getByRole("treeitem", { name: "Paragraph" });
    expect(paragraph).toHaveAttribute("aria-selected", "true");
    expect(paragraph).toHaveFocus();
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(findNode(latest().root, "n2")?.children.map((child) => child.id)).toEqual([
      "n4",
      "n3",
      "n5",
    ]);
    expect(screen.getByRole("status")).toHaveTextContent("Moved Paragraph");
    await user.keyboard("{Control>}z{/Control}");
    expect(findNode(latest().root, "n2")?.children.map((child) => child.id)).toEqual([
      "n3",
      "n4",
      "n5",
    ]);
  });

  it("renames, hides and locks layers", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder(heroPage());
    const tree = screen.getByRole("tree", { name: "Layers" });
    await user.click(within(tree).getByRole("treeitem", { name: "Paragraph" }));
    await user.keyboard("{Enter}");
    const input = screen.getByRole("textbox", { name: "Layer name" });
    await user.clear(input);
    await user.type(input, "Intro{Enter}");
    expect(findNode(latest().root, "n4")?.name).toBe("Intro");
    await user.click(within(tree).getByRole("button", { name: "Hide Intro" }));
    expect(findNode(latest().root, "n4")?.hidden).toBe(true);
    await user.click(within(tree).getByRole("button", { name: "Lock Hero title" }));
    await user.click(within(tree).getByRole("treeitem", { name: "Hero title, locked" }));
    await user.keyboard("{Delete}");
    expect(screen.getByRole("status")).toHaveTextContent("Hero title is locked");
    expect(findNode(latest().root, "n3")).toBeDefined();
  });

  it("styles the selected element, with changes for phones shown by a dot", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder(heroPage());
    await user.click(
      within(screen.getByRole("tree")).getByRole("treeitem", { name: "Hero title" }),
    );
    const textSize = screen.getByRole("group", { name: "Text size" });
    await user.click(within(textSize).getByRole("button", { name: "Huge" }));
    expect(findNode(latest().root, "n3")?.styles.base.fontSize).toBe("2rem");

    await user.click(screen.getByRole("radio", { name: "Phone" }));
    await user.click(
      within(screen.getByRole("group", { name: "Text size" })).getByRole("button", {
        name: "Large",
      }),
    );
    expect(findNode(latest().root, "n3")?.styles).toMatchObject({
      base: { fontSize: "2rem" },
      phone: { fontSize: "1.25rem" },
    });
    expect(screen.getByText("Changed for phones")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(findNode(latest().root, "n3")?.styles.phone).toBeUndefined();
  });

  it("shows more style controls in Advanced", async () => {
    const user = userEvent.setup();
    renderBuilder(heroPage());
    await user.click(within(screen.getByRole("tree")).getByRole("treeitem", { name: "Hero" }));
    expect(
      screen.queryByRole("group", { name: "Margin and padding, side by side" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Advanced" }));
    // Advanced opens with every group closed, each saying what's set inside.
    const spacing = screen.getByRole("button", { name: /^Spacing/ });
    expect(spacing).toHaveAttribute("aria-expanded", "false");
    expect(spacing).toHaveTextContent("Inside 3XL");
    await user.click(spacing);
    expect(
      screen.getByRole("group", { name: "Margin and padding, side by side" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Padding Top" })).toHaveValue("3XL");
  });

  it("edits what an element says in the Content panel", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder(heroPage());
    await user.click(within(screen.getByRole("tree")).getByRole("treeitem", { name: "Button" }));
    await user.click(screen.getByRole("tab", { name: "Content" }));
    const words = screen.getByRole("textbox", { name: "Words on the button" });
    await user.clear(words);
    await user.type(words, "Book now");
    expect(findNode(latest().root, "n5")?.props.label).toBe("Book now");
  });

  it("brings what Insert adds into view (LINTEL-UX-306)", async () => {
    const user = userEvent.setup();
    renderBuilder(heroPage());
    const frameWindow = document.querySelector("iframe")?.contentWindow as Window;
    const post = vi.spyOn(frameWindow, "postMessage");
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", { data: { type: "ready" }, source: frameWindow }),
      );
    });

    await user.click(screen.getByRole("tab", { name: "Insert" }));
    await user.click(screen.getByRole("radio", { name: "Elements" }));
    await user.type(screen.getByRole("searchbox"), "Divider");
    await user.click(screen.getByRole("button", { name: "Divider" }));

    expect(post).toHaveBeenCalledWith({ type: "reveal", nodeId: "new1" }, "*");
  });

  it("offers the Code element only with the code permission", async () => {
    const user = userEvent.setup();
    renderBuilder(heroPage());
    await user.click(screen.getByRole("tab", { name: "Insert" }));
    expect(screen.queryByRole("button", { name: /^Code/ })).not.toBeInTheDocument();
  });

  it("edits a Code element's HTML in Content for people who may write code", async () => {
    const user = userEvent.setup();
    const page = createEmptyPage();
    const code = createNode(
      { type: "codeBlock", name: "Opening times" },
      standardCatalogue,
      createCountingNodeIds("code"),
    );
    const { latest } = renderBuilder(
      { ...page, root: { ...page.root, children: [code] } },
      { canEditCode: true },
    );
    await user.click(
      within(screen.getByRole("tree")).getByRole("treeitem", { name: "Opening times" }),
    );
    await user.click(screen.getByRole("tab", { name: "Content" }));
    const html = screen.getByRole("textbox", { name: "HTML" });
    await user.clear(html);
    await user.type(html, "<p>Open every day</p>");
    await user.click(screen.getByRole("button", { name: "Save code" }));
    expect(latest().root.children[0]?.props.html).toBe("<p>Open every day</p>");
  });

  it("doesn't show a Code element's code to people who may not write code", async () => {
    const user = userEvent.setup();
    const page = createEmptyPage();
    const code = createNode(
      { type: "codeBlock", name: "Opening times" },
      standardCatalogue,
      createCountingNodeIds("code"),
    );
    renderBuilder({ ...page, root: { ...page.root, children: [code] } });
    await user.click(
      within(screen.getByRole("tree")).getByRole("treeitem", { name: "Opening times" }),
    );
    await user.click(screen.getByRole("tab", { name: "Content" }));
    expect(screen.queryByRole("textbox", { name: "HTML" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save code" })).not.toBeInTheDocument();
  });

  it("pastes HTML from another app as elements", async () => {
    const { latest } = renderBuilder(heroPage());
    const paste = new Event("paste", { bubbles: true }) as Event & {
      clipboardData: Pick<DataTransfer, "getData">;
    };
    paste.clipboardData = {
      getData: (type: string) =>
        type === "text/html" ? "<h2>Opening hours</h2><p>Every day</p>" : "",
    };
    await act(async () => {
      document.body.dispatchEvent(paste);
    });
    expect(
      latest()
        .root.children.slice(1)
        .map((node) => node.type),
    ).toEqual(["heading", "text"]);
  });
});
