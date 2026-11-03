import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type NodeBlueprint,
  type PageDocument,
  type PageNode,
  standardCatalogue,
} from "@lintel/builder-model";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PageBuilder } from "../PageBuilder.js";
import { createMemoryPreferenceStore } from "../preferences/builder-preferences.js";
import { renderPage } from "../render/render-page.js";
import { standardRegistry } from "../render/stand-in-components.js";

function pageWith(...blueprints: NodeBlueprint[]): PageDocument {
  const createId = createCountingNodeIds();
  const page = createEmptyPage();
  const section = createNode(
    { type: "section", children: blueprints },
    standardCatalogue,
    createId,
  );
  return { ...page, root: { ...page.root, children: [section] } };
}

/** The page with one element changed, as a designer's earlier choices would have left it. */
function withNode(document: PageDocument, path: number[], patch: Partial<PageNode>): PageDocument {
  const change = (node: PageNode, rest: number[]): PageNode => {
    const [index, ...deeper] = rest;
    if (index === undefined) return { ...node, ...patch };
    return {
      ...node,
      children: node.children.map((child, at) => (at === index ? change(child, deeper) : child)),
    };
  };
  return { ...document, root: change(document.root, path) };
}

const nodeAt = (document: PageDocument, ...path: number[]): PageNode =>
  path.reduce<PageNode>((node, index) => node.children[index] as PageNode, document.root);

function renderBuilder(
  document: PageDocument,
  options: { contentOnly?: boolean; preferences?: Record<string, string> } = {},
) {
  const onChange = vi.fn<(document: PageDocument) => void>();
  render(
    <PageBuilder
      initialDocument={document}
      onChange={onChange}
      title="Home"
      canEditCode={false}
      contentOnly={options.contentOnly}
      createId={createCountingNodeIds("new")}
      preferences={createMemoryPreferenceStore(
        options.preferences ?? { tourSeen: "yes", clientTourSeen: "yes" },
      )}
    />,
  );
  const latest = () => onChange.mock.lastCall?.[0] as PageDocument;
  return { onChange, latest };
}

/** A message from the canvas frame, as the page inside it would send it. */
function fromCanvas(data: Record<string, unknown>) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        source: document.querySelector("iframe")!.contentWindow,
        data,
      }),
    );
  });
}

describe("the client's view (content only)", () => {
  const page = () =>
    withNode(
      pageWith(
        { type: "heading", props: { text: "Fresh bread" } },
        { type: "button", props: { label: "Order", href: "/order" } },
        { type: "heading", props: { text: "Our story" } },
        { type: "box", name: "Cards", children: [{ type: "card" }, { type: "card" }] },
      ),
      [0, 3],
      { clientRepeats: true },
    );

  it("shows the page and the content panel, without the designer's tools", () => {
    renderBuilder(page(), { contentOnly: true });
    expect(screen.queryByRole("tab", { name: "Insert" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Layers" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Style" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Animate" })).toBeNull();
    expect(screen.queryByText("What clients can change")).toBeNull();
    expect(screen.getByText("Change what you see")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Undo/ })).toBeInTheDocument();
  });

  it("shows only the fields a client may change, and changes them", async () => {
    const user = userEvent.setup();
    const document = page();
    const { latest } = renderBuilder(document, { contentOnly: true });
    fromCanvas({ type: "select", nodeId: nodeAt(document, 0, 1).id });
    const words = screen.getByRole("textbox", { name: "Words on the button" });
    expect(screen.queryByRole("switch", { name: "Open in a new tab" })).toBeNull();
    await user.clear(words);
    await user.type(words, "Buy");
    expect(nodeAt(latest(), 0, 1).props.label).toBe("Buy");
  });

  it("types only into words the client may change", () => {
    const document = page();
    const heading = nodeAt(document, 0, 0);
    const { onChange, latest } = renderBuilder(document, { contentOnly: true });
    fromCanvas({ type: "editText", nodeId: heading.id, prop: "text", text: "Warm bread" });
    expect(nodeAt(latest(), 0, 0).props.text).toBe("Warm bread");
    const calls = onChange.mock.calls.length;
    fromCanvas({ type: "editText", nodeId: nodeAt(document, 0).id, prop: "anchor", text: "x" });
    expect(onChange.mock.calls.length).toBe(calls);
  });

  it("says a part of the design stays as it is", () => {
    const document = page();
    renderBuilder(document, { contentOnly: true });
    fromCanvas({ type: "select", nodeId: nodeAt(document, 0).id });
    expect(screen.getByText(/is part of the design, so it stays as it is/)).toBeInTheDocument();
  });

  it("adds and removes items only where the designer allows it", async () => {
    const user = userEvent.setup();
    const document = page();
    const { latest } = renderBuilder(document, { contentOnly: true });
    fromCanvas({ type: "select", nodeId: nodeAt(document, 0, 3, 0).id });
    await user.click(screen.getByRole("button", { name: "Add another" }));
    expect(nodeAt(latest(), 0, 3).children).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Remove this one" }));
    expect(nodeAt(latest(), 0, 3).children).toHaveLength(2);

    fromCanvas({ type: "select", nodeId: nodeAt(document, 0, 0).id });
    expect(screen.queryByRole("button", { name: "Add another" })).toBeNull();
  });

  it("starts with a short tour of its own", () => {
    renderBuilder(page(), { contentOnly: true, preferences: { clientTourSeen: "no" } });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("This is your page")).toBeInTheDocument();
  });

  it("marks only the words a client may change as typeable on the canvas", () => {
    const document = withNode(
      pageWith({ type: "heading", props: { text: "Open" } }, { type: "heading" }),
      [0, 1],
      { clientEdits: [] },
    );
    const { html } = renderPage(document, standardRegistry, {
      mode: "canvas",
      mayEditText: (node) => node.clientEdits === undefined,
    });
    expect(html.match(/data-lintel-text=/g)).toHaveLength(1);
  });
});

describe("the designer's controls", () => {
  it("chooses what clients can change on an element, and lets them add more", async () => {
    const user = userEvent.setup();
    const document = pageWith(
      { type: "button", props: { label: "Order" } },
      { type: "box", name: "Cards", children: [{ type: "card" }, { type: "card" }] },
    );
    const { latest } = renderBuilder(document);
    fromCanvas({ type: "select", nodeId: nodeAt(document, 0, 0).id });
    await user.click(screen.getByRole("tab", { name: "Content" }));
    await user.click(screen.getByRole("button", { name: /What clients can change/ }));
    const choices = screen.getByRole("group", { name: "What clients can change" });
    expect(within(choices).getByRole("button", { name: "Words" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(within(choices).getByRole("button", { name: "Links" }));
    expect(nodeAt(latest(), 0, 0).clientEdits).toEqual(["words"]);
    await user.click(within(choices).getByRole("button", { name: "Nothing" }));
    expect(nodeAt(latest(), 0, 0).clientEdits).toEqual([]);

    fromCanvas({ type: "select", nodeId: nodeAt(document, 0, 1, 0).id });
    await user.click(screen.getByRole("button", { name: /What clients can change/ }));
    await user.click(screen.getByRole("switch", { name: "Clients can add more of these" }));
    expect(nodeAt(latest(), 0, 1).clientRepeats).toBe(true);
  });

  it("opens old pages unchanged for designers", () => {
    const document = pageWith({ type: "heading", props: { text: "Hello" } });
    const { onChange } = renderBuilder(document);
    expect(screen.getByRole("tab", { name: "Insert" })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
