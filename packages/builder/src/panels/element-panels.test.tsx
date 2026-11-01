import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type NodeBlueprint,
  type PageDocument,
  type PageNode,
  sectionTemplates,
  standardCatalogue,
} from "@lintel/builder-model";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { canvasPageData } from "./canvas-data.js";
import { groupContentFields } from "./content-groups.js";
import { ContentPanel } from "./ContentPanel.js";
import {
  type BuilderDataSources,
  DataSourcesContext,
  findBindingScope,
  noDataSources,
} from "./data-sources.js";
import { groupInsertItems, insertItems } from "./insert-library.js";

function pageWith(...blueprints: NodeBlueprint[]): PageDocument {
  const page = createEmptyPage();
  const ids = createCountingNodeIds("p");
  return {
    ...page,
    root: {
      ...page.root,
      children: blueprints.map((blueprint) => createNode(blueprint, standardCatalogue, ids)),
    },
  };
}

const sources: BuilderDataSources = {
  ...noDataSources,
  collections: [
    {
      handle: "posts",
      name: "Blog posts",
      fields: [{ path: "data.reading_time", label: "Reading time", kind: "text" }],
      terms: [{ value: "categories/bread", label: "Categories: Bread" }],
      samples: [{ id: "s1", fields: { title: "A sample post" } }],
    },
  ],
};

/** The Content panel for one element, keeping its changes like the builder would. */
function EditedElement({ start, document }: { start: PageNode; document: PageDocument }) {
  const [node, setNode] = useState(start);
  return (
    <DataSourcesContext.Provider value={sources}>
      <ContentPanel
        node={node}
        definition={standardCatalogue.find(node.type)}
        isLocked={false}
        pickImage={undefined}
        document={document}
        onChange={(props) =>
          setNode((current) => ({ ...current, props: { ...current.props, ...props } }))
        }
        onBind={(prop, path) =>
          setNode((current) => {
            const bindings = { ...current.bindings };
            if (path) bindings[prop] = path;
            else delete bindings[prop];
            return { ...current, bindings };
          })
        }
      />
      <output data-testid="state">
        {JSON.stringify({ props: node.props, bindings: node.bindings ?? {} })}
      </output>
    </DataSourcesContext.Provider>
  );
}

const state = () =>
  JSON.parse(screen.getByTestId("state").textContent ?? "{}") as {
    props: Record<string, unknown>;
    bindings: Record<string, string>;
  };

describe("the element library in the panels", () => {
  it("offers the new groups, and the shop's and forms' elements only with their plugins", () => {
    const items = insertItems(sectionTemplates, standardCatalogue.definitions);
    const groups = groupInsertItems(items, "elements").map((group) => group.id);
    expect(groups).toEqual([
      "blocks",
      "layout",
      "text",
      "media",
      "navigation",
      "collections",
      "forms",
      "shop",
      "code",
    ]);
    expect(items.some((item) => item.label === "Tab")).toBe(true);
  });

  it("folds advanced options into “More options”, after everything else", () => {
    const groups = groupContentFields(standardCatalogue.find("video")?.editableFields ?? []);
    expect(groups.map((group) => group.id)).toEqual(["options", "words", "picture", "more"]);
    const list = groupContentFields(standardCatalogue.find("collectionList")?.editableFields ?? []);
    expect(list[0]?.id).toBe("source");
    expect(list.at(-1)?.id).toBe("more");
  });

  it("knows which list an element is inside, and the item page's collection", () => {
    const document = pageWith(
      { type: "collectionList", props: { collection: "posts" } },
      { type: "heading" },
    );
    const list = document.root.children[0] as PageNode;
    const heading = list.children[0]?.children[2] as PageNode;
    const scope = findBindingScope(document, heading.id, sources);
    expect(scope?.name).toBe("Blog posts");
    expect(scope?.fields.map((field) => field.path)).toContain("data.reading_time");
    expect(findBindingScope(document, document.root.children[1]?.id ?? "", sources)).toBeNull();
    const itemPage = { ...document, root: { ...document.root, props: { itemDesignFor: "posts" } } };
    expect(findBindingScope(itemPage, document.root.children[1]?.id ?? "", sources)?.name).toBe(
      "Blog posts",
    );
    expect(canvasPageData(itemPage, sources).item?.fields.title).toBe("A sample post");
    expect(canvasPageData(document, sources).lists?.[list.id]?.items).toHaveLength(1);
  });

  it("binds a heading in a list to a field, and back to typed words", async () => {
    const document = pageWith({ type: "collectionList", props: { collection: "posts" } });
    const heading = (document.root.children[0] as PageNode).children[0]?.children[2] as PageNode;
    render(<EditedElement start={heading} document={document} />);
    const person = userEvent.setup();
    const shows = screen.getByRole("combobox", { name: "Text: Shows" });
    expect(shows).toHaveValue("title");
    expect(screen.queryByRole("textbox", { name: "Text" })).not.toBeInTheDocument();
    await person.selectOptions(shows, "data.reading_time");
    expect(state().bindings).toEqual({ text: "data.reading_time" });
    await person.selectOptions(shows, "");
    expect(state().bindings).toEqual({});
    expect(screen.getByRole("textbox", { name: "Text" })).toHaveValue("Entry title");
  });

  it("chooses a collection and a category from the site's own lists", async () => {
    const document = pageWith({ type: "collectionList" });
    render(<EditedElement start={document.root.children[0] as PageNode} document={document} />);
    const person = userEvent.setup();
    await person.selectOptions(screen.getByRole("combobox", { name: "Collection" }), "posts");
    await person.selectOptions(
      screen.getByRole("combobox", { name: "Only entries filed under" }),
      "categories/bread",
    );
    expect(state().props).toMatchObject({ collection: "posts", term: "categories/bread" });
  });

  it("adds, edits and removes the items of a list, such as a pricing table's plans", async () => {
    const document = pageWith({ type: "pricingTable" });
    render(<EditedElement start={document.root.children[0] as PageNode} document={document} />);
    const person = userEvent.setup();
    const plans = screen.getByRole("group", { name: "Plans" });
    await person.click(within(plans).getByRole("button", { name: "Add a plan" }));
    expect((state().props.plans as unknown[]).length).toBe(4);
    await person.click(within(plans).getByText("New plan"));
    const name = within(plans).getAllByRole("textbox", { name: "Name" }).at(-1) as HTMLElement;
    await person.clear(name);
    await person.type(name, "Charity");
    expect((state().props.plans as Array<{ name: string }>)[3]?.name).toBe("Charity");
    await person.click(within(plans).getByRole("button", { name: "Remove Starter" }));
    expect((state().props.plans as Array<{ name: string }>).map((plan) => plan.name)).toEqual([
      "Growing",
      "Agency",
      "Charity",
    ]);
  });

  it("picks an icon from the built-in set by searching", async () => {
    const document = pageWith({ type: "icon" });
    render(<EditedElement start={document.root.children[0] as PageNode} document={document} />);
    const person = userEvent.setup();
    await person.type(screen.getByRole("searchbox", { name: "Find an icon" }), "truck");
    await person.click(screen.getByRole("radio", { name: "truck" }));
    expect(state().props.name).toBe("truck");
  });
});
