import type {
  BindableField,
  DataCollection,
  DataForm,
  DataMenuLink,
  DataSourceKind,
  PageDocument,
  PageNode,
  PhotoCreditData,
  ShopProduct,
} from "@lintel/builder-model";
import { entryFields, productFields } from "@lintel/builder-model";
import { createContext, useContext } from "react";

/**
 * What the site has that elements can show: its collections (with their fields, terms and
 * a few sample entries for the canvas), its forms and its products. The app passes it to
 * the builder; without it the pickers are plain text boxes.
 */
export interface BuilderDataSources {
  collections: readonly DataCollection[];
  forms: readonly { value: string; label: string }[];
  products: readonly { value: string; label: string }[];
  productCollections: readonly { value: string; label: string }[];
  /** A few of the shop's products, for product grids on the canvas. */
  sampleProducts?: readonly ShopProduct[];
  /** The site's forms, as a page draws them, so a Form element on the canvas shows the form. */
  sampleForms?: readonly DataForm[];
  /**
   * The site's menus with their links, so headers and menus on the canvas show the real
   * thing (and "Which menu" can offer them). Without them the canvas shows a sample menu.
   */
  menus?: readonly { handle: string; name: string; links: readonly DataMenuLink[] }[];
  /**
   * Credits of the media library's pictures that need one, by asset id, so Picture elements
   * on the canvas show them and offer "Show the photo credit". Pictures not listed have none.
   */
  photoCredits?: Readonly<Record<string, PhotoCreditData>>;
}

export const noDataSources: BuilderDataSources = {
  collections: [],
  forms: [],
  products: [],
  productCollections: [],
};

export const DataSourcesContext = createContext<BuilderDataSources>(noDataSources);

export function useDataSources(): BuilderDataSources {
  return useContext(DataSourcesContext);
}

/** The choices a source field offers. `node` gives the collection a term filter is for. */
export function sourceChoices(
  sources: BuilderDataSources,
  source: DataSourceKind,
  node: PageNode,
  dependsOn: string | undefined,
): readonly { value: string; label: string }[] {
  switch (source) {
    case "collections":
      return sources.collections.map((collection) => ({
        value: collection.handle,
        label: collection.name,
      }));
    case "terms": {
      const handle = dependsOn ? String(node.props[dependsOn] ?? "") : "";
      return sources.collections.find((collection) => collection.handle === handle)?.terms ?? [];
    }
    case "forms":
      return sources.forms;
    case "products":
      return sources.products;
    case "productCollections":
      return sources.productCollections;
  }
}

/** The list or item page an element's bound fields come from, if it is inside one. */
export type BindingScope =
  | { kind: "collection"; fields: readonly BindableField[]; name: string }
  | { kind: "block"; fields: readonly BindableField[]; name: string }
  | { kind: "product"; fields: readonly BindableField[]; name: string };

/**
 * The nearest collection list or product grid around `nodeId`, or the collection the page
 * is the item design for. Elements outside all of these have nothing to bind to.
 */
export function findBindingScope(
  document: PageDocument,
  nodeId: string,
  sources: BuilderDataSources,
): BindingScope | null {
  const path = pathTo(document.root, nodeId);
  if (!path) return null;
  const ancestors = path.slice(0, -1).reverse();
  for (const ancestor of ancestors) {
    if (ancestor.type === "collectionList") {
      return collectionScope(String(ancestor.props.collection ?? ""), sources);
    }
    if (ancestor.type === "productGrid") {
      return { kind: "product", fields: productFields, name: "Product" };
    }
  }
  const pageFor = String(document.root.props.itemDesignFor ?? "");
  if (pageFor === "shop:products")
    return { kind: "product", fields: productFields, name: "Product" };
  return pageFor && nodeId !== document.root.id ? collectionScope(pageFor, sources) : null;
}

function collectionScope(handle: string, sources: BuilderDataSources): BindingScope {
  const collection = sources.collections.find((candidate) => candidate.handle === handle);
  const extra = (collection?.fields ?? []).filter(
    (field) => !entryFields.some((common) => common.path === field.path),
  );
  return {
    kind: "collection",
    fields: [...entryFields, ...extra],
    name: collection?.name ?? "Entry",
  };
}

function pathTo(node: PageNode, nodeId: string): PageNode[] | null {
  if (node.id === nodeId) return [node];
  for (const child of node.children) {
    const path = pathTo(child, nodeId);
    if (path) return [node, ...path];
  }
  return null;
}
