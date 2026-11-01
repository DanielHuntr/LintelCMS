import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type PageDocument,
  type PageNode,
  standardCatalogue,
} from "@lintel/builder-model";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { canvasPageData } from "../panels/canvas-data.js";
import { ContentPanel } from "../panels/ContentPanel.js";
import { type BuilderDataSources, noDataSources } from "../panels/data-sources.js";
import { renderPage } from "../render/render-page.js";
import { standardRegistry } from "../render/stand-in-components.js";
import { MenuEditingContext, type RenderMenuEditor } from "./menu-editing.js";

function pageWith(type: string, props: Record<string, unknown> = {}): PageDocument {
  const page = createEmptyPage();
  const node = createNode({ type, props }, standardCatalogue, createCountingNodeIds("p"));
  return { ...page, root: { ...page.root, children: [node] } };
}

const withMenus = (links: BuilderDataSources["menus"]): BuilderDataSources => ({
  ...noDataSources,
  menus: links,
});

const canvasHtml = (document: PageDocument, sources: BuilderDataSources) =>
  renderPage(document, standardRegistry, {
    mode: "canvas",
    data: canvasPageData(document, sources),
  }).html;

describe("site menus on the canvas", () => {
  const mainMenu = {
    handle: "main",
    name: "Main menu",
    links: [
      { label: "About", url: "/about", current: false, children: [] },
      { label: "Book now", url: "/book", current: false, style: "button" as const, children: [] },
    ],
  };
  const footer = {
    handle: "footer",
    name: "Footer",
    links: [{ label: "Privacy", url: "/privacy", current: false, children: [] }],
  };

  it("draws a new Header with the main menu, and a button item as a button", () => {
    const html = canvasHtml(pageWith("siteHeader"), withMenus([mainMenu]));
    expect(html).toContain(">About</a>");
    expect(html).toMatch(/class="[^"]*lintel-mega__link--button[^"]*"[^>]*>Book now/);
  });

  it("draws the menu an element chose", () => {
    const html = canvasHtml(
      pageWith("navigation", { menuHandle: "footer" }),
      withMenus([mainMenu, footer]),
    );
    expect(html).toContain(">Privacy</a>");
    expect(html).not.toContain("About");
  });

  it("offers “Add pages to your menu” in place of an empty menu, on the canvas only", () => {
    const document = pageWith("siteHeader");
    const empty = withMenus([{ ...mainMenu, links: [] }]);
    expect(canvasHtml(document, empty)).toContain("Add pages to your menu");
    expect(canvasHtml(document, empty)).toContain("data-lintel-open-menu=");
    const site = renderPage(document, standardRegistry, {
      mode: "site",
      data: canvasPageData(document, empty),
    });
    expect(site.html).not.toContain("Add pages to your menu");
  });
});

describe("“Edit menu” in the Content tab", () => {
  function EditedHeader({ renderEditor }: { renderEditor: RenderMenuEditor }) {
    const document = pageWith("siteHeader");
    const [node, setNode] = useState<PageNode>(document.root.children[0] as PageNode);
    const [editingFor, setEditingFor] = useState<string | null>(null);
    return (
      <MenuEditingContext.Provider
        value={{
          renderEditor,
          choices: [
            { value: "main", label: "Main menu" },
            { value: "footer", label: "Footer" },
          ],
          editingFor,
          setEditingFor,
        }}
      >
        <ContentPanel
          node={node}
          definition={standardCatalogue.find(node.type)}
          isLocked={false}
          pickImage={undefined}
          onChange={(props) =>
            setNode((current) => ({ ...current, props: { ...current.props, ...props } }))
          }
        />
        <output data-testid="menu-handle">{String(node.props.menuHandle)}</output>
      </MenuEditingContext.Provider>
    );
  }

  it("picks which menu, then edits that menu in the panel", async () => {
    const user = userEvent.setup();
    render(
      <EditedHeader
        renderEditor={({ menuHandle, onClose }) => (
          <div>
            <p>Editing {menuHandle}</p>
            <button type="button" onClick={onClose}>
              Close the editor
            </button>
          </div>
        )}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Which menu"), "footer");
    expect(screen.getByTestId("menu-handle")).toHaveTextContent("footer");

    await user.click(screen.getByRole("button", { name: "Edit menu" }));
    expect(screen.getByText("Editing footer")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close the editor" }));
    expect(screen.getByRole("button", { name: "Edit menu" })).toBeInTheDocument();
  });
});
