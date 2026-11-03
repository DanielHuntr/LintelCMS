import {
  type BoundPicture,
  type CustomBlock,
  currentValues,
  findBlockInstances,
  instanceValues,
  type PageData,
  type PageNode,
  readRows,
  rowProperties,
  type BlockProperty,
} from "@lintel/builder-model";
import { renderBlockComponent } from "@lintel/builder/render";
import type { DatabaseOrTransaction } from "../database/client.js";
import type { AssetLookup } from "../fieldtypes/image-assets.js";
import { loadBlockLibrary, pictureIdsIn, picturesFromAssets } from "./blocks.service.js";
import { findBlockComponent } from "./define-block.js";

/**
 * What a page needs to draw its instances of the site's blocks, added to its data: the
 * blocks themselves, the pictures their image properties point at, and the HTML of blocks
 * the server draws (React components from code and plugins). The website, static publishing
 * and the admin's previews all go through this, so a block looks the same everywhere.
 */
export async function loadBlockPageData(
  database: DatabaseOrTransaction,
  root: PageNode,
  assetLookup: AssetLookup | undefined,
): Promise<Pick<PageData, "blocks" | "pictures" | "renderedBlocks">> {
  const instances = findBlockInstances(root);
  if (instances.length === 0) return {};
  const library = Object.fromEntries(
    (await loadBlockLibrary(database)).map((block) => [block.handle, block]),
  );
  const pictures = assetLookup
    ? await picturesFromAssets(assetLookup, pictureIdsIn(root, library))
    : {};
  const renderedBlocks = await renderServerBlocks(
    instances.map((node) => ({
      id: node.id,
      block: String(node.props.block),
      values: instanceValues(node),
    })),
    library,
    undefined,
    pictures,
  );
  return { blocks: library, pictures, renderedBlocks };
}

/** The HTML of each instance whose block is a React component, by instance id. */
export async function renderServerBlocks(
  instances: readonly { id: string; block: string; values: Readonly<Record<string, unknown>> }[],
  library: Readonly<Record<string, CustomBlock>>,
  assetLookup: AssetLookup | undefined,
  knownPictures: Readonly<Record<string, BoundPicture>> = {},
): Promise<Record<string, string>> {
  const drawn = instances.filter((instance) => {
    const block = library[instance.block];
    return block && !block.design && block.template === null && findBlockComponent(block.handle);
  });
  if (drawn.length === 0) return {};
  const pictures = { ...knownPictures };
  if (assetLookup) {
    const ids = drawn.flatMap((instance) =>
      imageIds(instance.values, library[instance.block]?.properties ?? []),
    );
    Object.assign(
      pictures,
      await picturesFromAssets(
        assetLookup,
        ids.filter((id) => !pictures[id]),
      ),
    );
  }
  const html: Record<string, string> = {};
  for (const instance of drawn) {
    const block = library[instance.block] as CustomBlock;
    const component = findBlockComponent(block.handle);
    if (!component) continue;
    const values = currentValues(instance.values, block.renamedProperties);
    html[instance.id] = renderBlockComponent(
      component,
      componentProperties(values, block.properties, pictures),
    );
  }
  return html;
}

/**
 * Values as a React block's `properties`: pictures as `{ src, alt, width, height }` (or null),
 * lists as arrays of their rows' values, everything else as stored.
 */
export function componentProperties(
  values: Readonly<Record<string, unknown>>,
  properties: readonly BlockProperty[],
  pictures: Readonly<Record<string, BoundPicture>>,
): Record<string, unknown> {
  const shown: Record<string, unknown> = {};
  for (const property of properties) {
    const value = values[property.handle] ?? property.default ?? null;
    if (property.type === "image") {
      shown[property.handle] = typeof value === "string" ? (pictures[value] ?? null) : null;
    } else if (property.type === "repeater") {
      shown[property.handle] = readRows(value).map((row) =>
        componentProperties(row.data, rowProperties(property), pictures),
      );
    } else {
      shown[property.handle] = value;
    }
  }
  return shown;
}

function imageIds(
  values: Readonly<Record<string, unknown>>,
  properties: readonly BlockProperty[],
): string[] {
  return properties.flatMap((property) => {
    const value = values[property.handle];
    if (property.type === "image" && typeof value === "string") return [value];
    if (property.type === "repeater") {
      return readRows(value).flatMap((row) => imageIds(row.data, rowProperties(property)));
    }
    return [];
  });
}
