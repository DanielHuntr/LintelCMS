import {
  type BoundPicture,
  createRandomNodeId,
  componentVariantsOf,
  type CustomBlock,
  detachBlockInstance,
  findBlockInstances,
  instanceValues,
  type PageNode,
  withoutMissingElements,
} from "@lintel/builder-model";
import { checkBlueprintFields } from "../blueprints/blueprint-fields.js";
import { listBlueprintRows, updateBlueprintFields } from "../blueprints/blueprints.repository.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type { EntryData } from "../entries/entries.table.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import type { BlockCheckLibrary } from "../fieldtypes/fieldtype.js";
import type { AssetLookup } from "../fieldtypes/image-assets.js";
import { readSetting } from "../settings/settings.service.js";
import { checkBlockDesign, checkComponentVariants, renameBindings } from "./block-design.js";
import {
  collectValues,
  isFilledIn,
  mapBlocksFieldValues,
  mapPageInstances,
  renameValues,
  withValues,
} from "./block-values.js";
import {
  BlockChangeNeedsConfirmationError,
  BlockHandleTakenError,
  BlockInUseError,
  BlockNotEditableError,
  BlockNotFoundError,
  type BlockPageUse,
} from "./blocks.errors.js";
import {
  deleteBlockRow,
  findBlockRow,
  insertBlockIfMissing,
  listBlockRows,
  listCollectionFields,
  listEntriesMentioning,
  updateBlockRow,
  updateEntryValues,
} from "./blocks.repository.js";
import type { BlockResponse, CreateBlockRequest, UpdateBlockRequest } from "./blocks.schema.js";
import type { BlockRow } from "./blocks.table.js";
import { checkProperties, listPluginBlocks } from "./define-block.js";
import { fillSiteBlockTypes, usesSiteBlock } from "./site-block-types.js";

/**
 * Business rules for the site's blocks. Pages store only each instance's values, so a
 * change to a block reaches every page at once. What changing a block can't do silently:
 *
 * - remove a property pages have filled in (409 BLOCK_CHANGE_NEEDS_CONFIRMATION, listing
 *   the pages, until `confirmRemovals`);
 * - lose values when a property is renamed: the old handle is remembered, and the values in
 *   saved and published pages are moved to the new one;
 * - delete a block pages use (409 BLOCK_IN_USE), unless its instances are turned into plain
 *   elements first (`convert`), so the pages look exactly as they did.
 *
 * Blocks from code and plugins can be used but not changed here.
 */

export interface BlockServices {
  database: DatabaseOrTransaction;
  /** For pictures when instances are turned into plain elements. */
  assetLookup?: AssetLookup;
}

/** The blocks the site has: its own, then those of plugins that are switched on. */
export async function loadBlockLibrary(database: DatabaseOrTransaction): Promise<CustomBlock[]> {
  const [rows, enabledPlugins] = await Promise.all([
    listBlockRows(database, DEFAULT_TENANT_ID),
    readSetting(database, "enabledPlugins"),
  ]);
  const own = rows.map(blockFromRow);
  const taken = new Set(own.map((block) => block.handle));
  return [...own, ...listPluginBlocks(enabledPlugins).filter((block) => !taken.has(block.handle))];
}

/** The library as saving a page checks it (see block-instances.ts). */
export async function loadBlockCheckLibrary(
  database: DatabaseOrTransaction,
): Promise<BlockCheckLibrary> {
  const library = new Map((await loadBlockLibrary(database)).map((block) => [block.handle, block]));
  return {
    find: (handle) => {
      const block = library.get(handle);
      return block
        ? {
            name: block.name,
            properties: block.properties as FieldDefinition[],
            renamedProperties: block.renamedProperties,
            variants: componentVariantsOf(block),
          }
        : undefined;
    },
  };
}

export async function listBlocks(
  database: DatabaseOrTransaction,
): Promise<{ blocks: BlockResponse[] }> {
  const library = await loadBlockLibrary(database);
  const rows = new Map(
    (await listBlockRows(database, DEFAULT_TENANT_ID)).map((row) => [row.handle, row]),
  );
  const blocks = await Promise.all(
    library.map(async (block) =>
      describeBlock(block, rows.get(block.handle), await findBlockUses(database, block.handle)),
    ),
  );
  return { blocks };
}

export async function findBlock(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<BlockResponse> {
  const block = await findLibraryBlockOrFail(database, handle);
  const row = await findBlockRow(database, DEFAULT_TENANT_ID, handle);
  return describeBlock(block, row, await findBlockUses(database, handle));
}

export async function createBlock(
  database: DatabaseOrTransaction,
  request: CreateBlockRequest,
): Promise<BlockResponse> {
  const properties = checkProperties(request.properties);
  const design = checkBlockDesign(request.design, properties);
  const variants = checkComponentVariants(request.variants, design);
  const handle = request.handle ?? (await freeHandle(database, request.name));
  if ((await loadBlockLibrary(database)).some((block) => block.handle === handle)) {
    throw new BlockHandleTakenError(handle);
  }
  const inserted = await insertBlockIfMissing(database, {
    handle,
    name: request.name,
    icon: request.icon,
    category: request.category,
    description: request.description,
    source: "site",
    properties,
    design,
    variants,
  });
  if (!inserted) throw new BlockHandleTakenError(handle);
  return findBlock(database, handle);
}

export async function updateBlock(
  { database }: BlockServices,
  handle: string,
  request: UpdateBlockRequest,
): Promise<BlockResponse> {
  const row = await findEditableRowOrFail(database, handle);
  const renames = Object.fromEntries(
    Object.entries(request.renamedProperties).filter(([from, to]) => from !== to),
  );
  const properties = checkProperties(request.properties);
  const design = checkBlockDesign(renameBindings(request.design, renames), properties);
  // Left out by older callers: the variants stay as they were, without looks for elements
  // the design no longer has.
  const variants = checkComponentVariants(
    request.variants === undefined
      ? withoutMissingElements(componentVariantsOf(row), design)
      : request.variants,
    design,
  );

  const kept = new Set(properties.map((property) => property.handle));
  const removed = row.properties
    .map((property) => property.handle)
    .filter((old) => !kept.has(renames[old] ?? old));
  if (removed.length > 0 && !request.confirmRemovals) {
    const pages = await pagesWithValuesFor(database, row, removed);
    if (pages.length > 0) throw new BlockChangeNeedsConfirmationError(removed, pages);
  }

  const renamedProperties = chainRenames(row.renamedProperties, renames);
  const propertiesChanged =
    JSON.stringify(row.properties) !== JSON.stringify(properties) ||
    Object.keys(renames).length > 0;
  await database.transaction(async (transaction) => {
    await updateBlockRow(transaction, row.id, {
      name: request.name,
      icon: request.icon,
      category: request.category,
      description: request.description,
      properties,
      design,
      variants,
      renamedProperties,
      version: propertiesChanged ? row.version + 1 : row.version,
    });
    if (Object.keys(renames).length > 0) {
      await changeStoredValues(transaction, handle, renameValues(renames));
    }
    await refreshSiteBlockTypes(transaction, handle);
  });
  return findBlock(database, handle);
}

/**
 * Deletes a block. While pages use it, it is refused unless `convert`, which first turns
 * every instance into the plain elements of its design, in saved and published pages, and
 * makes blocks fields' block types ordinary ones with the same fields.
 */
export async function deleteBlock(
  { database, assetLookup }: BlockServices,
  handle: string,
  { convert }: { convert: boolean },
): Promise<void> {
  const row = await findEditableRowOrFail(database, handle);
  const uses = await findBlockUses(database, handle);
  if (uses.pages.length > 0 && !convert) throw new BlockInUseError(row.name, uses.pages);
  const block = blockFromRow(row);
  const pictures = await picturesFor(database, block, assetLookup);
  await database.transaction(async (transaction) => {
    for (const entry of await listEntriesMentioning(
      transaction,
      DEFAULT_TENANT_ID,
      `"${handle}"`,
    )) {
      const detach = (value: EntryData | null) =>
        value === null
          ? null
          : (mapPageInstances(
              value,
              handle,
              (node) => detachBlockInstance(node, block, createRandomNodeId, pictures) ?? node,
            ) as EntryData);
      const data = detach(entry.data) ?? entry.data;
      const publishedData = detach(entry.publishedData);
      if (data !== entry.data || publishedData !== entry.publishedData) {
        await updateEntryValues(transaction, entry.id, { data, publishedData });
      }
    }
    await forgetSiteBlockTypes(transaction, handle);
    await deleteBlockRow(transaction, row.id);
  });
}

/** What the model sync calls for a block file: its row made to match, as a code block. */
export async function saveCodeBlock(
  database: DatabaseOrTransaction,
  block: CustomBlock,
): Promise<void> {
  const row = await findBlockRow(database, DEFAULT_TENANT_ID, block.handle);
  const values = {
    name: block.name,
    icon: block.icon,
    category: block.category,
    description: block.description,
    source: "code" as const,
    properties: [...block.properties],
    design: null,
    template: block.template,
  };
  if (!row) {
    await insertBlockIfMissing(database, { handle: block.handle, ...values });
  } else {
    const changed = JSON.stringify(row.properties) !== JSON.stringify(values.properties);
    await updateBlockRow(database, row.id, {
      ...values,
      version: changed ? row.version + 1 : row.version,
    });
  }
  await refreshSiteBlockTypes(database, block.handle);
}

/**
 * A block file was deleted. The sync holds this back while pages use the block (see
 * model-impact.ts), so by the time it runs nothing shows it, or someone confirmed.
 */
export async function deleteCodeBlock(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<void> {
  const row = await findBlockRow(database, DEFAULT_TENANT_ID, handle);
  if (!row) return;
  await forgetSiteBlockTypes(database, handle);
  await deleteBlockRow(database, row.id);
}

/** The pages using a block, and the content types whose blocks fields offer it. */
export async function findBlockUses(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<{ pages: BlockPageUse[]; contentTypes: string[] }> {
  const blueprints = await listBlueprintRows(database, DEFAULT_TENANT_ID);
  const fieldsByCollection = await fieldsOfCollections(database);
  const entries = await listEntriesMentioning(database, DEFAULT_TENANT_ID, `"${handle}"`);
  const pages = entries
    .filter((entry) => {
      const fields = fieldsByCollection.get(entry.collection) ?? [];
      return (
        collectValues(entry.data, fields, handle).length > 0 ||
        collectValues(entry.publishedData, fields, handle).length > 0
      );
    })
    .map((entry) => ({
      entryId: entry.id,
      title: entry.title || entry.slug,
      collection: entry.collection,
    }));
  const contentTypes = blueprints
    .filter((blueprint) => usesSiteBlock(blueprint.fields, handle))
    .map((blueprint) => blueprint.name);
  return { pages, contentTypes };
}

/** Pages that have filled in any of these properties. */
async function pagesWithValuesFor(
  database: DatabaseOrTransaction,
  row: BlockRow,
  handles: readonly string[],
): Promise<BlockPageUse[]> {
  const fieldsByCollection = await fieldsOfCollections(database);
  const entries = await listEntriesMentioning(database, DEFAULT_TENANT_ID, `"${row.handle}"`);
  const migrate = renameValues(row.renamedProperties);
  return entries
    .filter((entry) => {
      const fields = fieldsByCollection.get(entry.collection) ?? [];
      return [entry.data, entry.publishedData].some((data) =>
        collectValues(data, fields, row.handle).some((values) => {
          const current = migrate(values);
          return handles.some((handle) => isFilledIn(current[handle]));
        }),
      );
    })
    .map((entry) => ({
      entryId: entry.id,
      title: entry.title || entry.slug,
      collection: entry.collection,
    }));
}

/** Changes the values of every use of a block, in saved and published pages. */
async function changeStoredValues(
  database: DatabaseOrTransaction,
  handle: string,
  change: (values: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  const fieldsByCollection = await fieldsOfCollections(database);
  for (const entry of await listEntriesMentioning(database, DEFAULT_TENANT_ID, `"${handle}"`)) {
    const fields = fieldsByCollection.get(entry.collection) ?? [];
    const update = (value: EntryData | null): EntryData | null => {
      if (value === null) return null;
      const pages = mapPageInstances(value, handle, (node) =>
        withValues(node, change),
      ) as EntryData;
      return mapBlocksFieldValues(pages, fields, handle, change);
    };
    await updateEntryValues(database, entry.id, {
      data: update(entry.data) ?? entry.data,
      publishedData: update(entry.publishedData),
    });
  }
}

/** Old handles point at the newest name, so a property renamed twice keeps its oldest values. */
function chainRenames(
  existing: Readonly<Record<string, string>>,
  renames: Readonly<Record<string, string>>,
): Record<string, string> {
  const chained: Record<string, string> = {};
  for (const [from, to] of Object.entries(existing)) chained[from] = renames[to] ?? to;
  for (const [from, to] of Object.entries(renames)) chained[from] = to;
  for (const [from, to] of Object.entries(chained)) if (from === to) delete chained[from];
  return chained;
}

async function fieldsOfCollections(
  database: DatabaseOrTransaction,
): Promise<Map<string, FieldDefinition[]>> {
  const collections = await listCollectionFields(database, DEFAULT_TENANT_ID);
  return new Map(collections.map((collection) => [collection.handle, collection.fields]));
}

/** Content types whose blocks fields offer this block get its current name and properties. */
async function refreshSiteBlockTypes(database: DatabaseOrTransaction, handle: string) {
  for (const blueprint of await listBlueprintRows(database, DEFAULT_TENANT_ID)) {
    if (!usesSiteBlock(blueprint.fields, handle)) continue;
    const fields = await fillSiteBlockTypes(database, blueprint.fields);
    await updateBlueprintFields(database, blueprint.id, {
      name: blueprint.name,
      fields: checkBlueprintFields(fields),
    });
  }
}

/** Blocks fields keep the block type, with its fields, as an ordinary one. */
async function forgetSiteBlockTypes(database: DatabaseOrTransaction, handle: string) {
  for (const blueprint of await listBlueprintRows(database, DEFAULT_TENANT_ID)) {
    if (!usesSiteBlock(blueprint.fields, handle)) continue;
    const fields = blueprint.fields.map((field) =>
      field.type !== "blocks"
        ? field
        : {
            ...field,
            options: {
              ...field.options,
              blockTypes: (field.options.blockTypes as Array<Record<string, unknown>>).map(
                (type) =>
                  type.block !== handle
                    ? type
                    : Object.fromEntries(Object.entries(type).filter(([key]) => key !== "block")),
              ),
            },
          },
    );
    await updateBlueprintFields(database, blueprint.id, { name: blueprint.name, fields });
  }
}

async function picturesFor(
  database: DatabaseOrTransaction,
  block: CustomBlock,
  assetLookup: AssetLookup | undefined,
): Promise<Record<string, BoundPicture>> {
  const imageHandles = block.properties
    .filter((property) => property.type === "image")
    .map((property) => property.handle);
  if (!assetLookup || imageHandles.length === 0) return {};
  const ids = new Set<string>();
  for (const entry of await listEntriesMentioning(
    database,
    DEFAULT_TENANT_ID,
    `"${block.handle}"`,
  )) {
    for (const data of [entry.data, entry.publishedData]) {
      if (!data) continue;
      mapPageInstances(data, block.handle, (node) => {
        const values = instanceValues(node);
        for (const handle of imageHandles)
          if (typeof values[handle] === "string") ids.add(values[handle]);
        return node;
      });
    }
  }
  return picturesFromAssets(assetLookup, [...ids]);
}

/** Pictures image properties point at, as the renderer draws them. */
export async function picturesFromAssets(
  assetLookup: AssetLookup,
  assetIds: readonly string[],
): Promise<Record<string, BoundPicture>> {
  if (assetIds.length === 0) return {};
  const assets = await assetLookup.findAssetsByIds([...new Set(assetIds)]);
  return Object.fromEntries(
    [...assets].map(([id, asset]) => [
      id,
      {
        src: asset.url,
        alt: asset.alt ?? "",
        width: asset.width ?? null,
        height: asset.height ?? null,
      },
    ]),
  );
}

/** The asset ids image properties hold in a page's instances. */
export function pictureIdsIn(
  root: PageNode,
  library: Readonly<Record<string, CustomBlock>>,
): string[] {
  const ids: string[] = [];
  for (const node of findBlockInstances(root)) {
    const block = library[String(node.props.block)];
    if (!block) continue;
    const values = instanceValues(node);
    for (const property of block.properties) {
      if (property.type === "image" && typeof values[property.handle] === "string") {
        ids.push(values[property.handle] as string);
      }
    }
  }
  return ids;
}

async function findLibraryBlockOrFail(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<CustomBlock> {
  const block = (await loadBlockLibrary(database)).find((candidate) => candidate.handle === handle);
  if (!block) throw new BlockNotFoundError(handle);
  return block;
}

async function findEditableRowOrFail(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<BlockRow> {
  const row = await findBlockRow(database, DEFAULT_TENANT_ID, handle);
  if (!row) {
    const block = (await loadBlockLibrary(database)).find(
      (candidate) => candidate.handle === handle,
    );
    if (block) throw new BlockNotEditableError(block.name, "plugin");
    throw new BlockNotFoundError(handle);
  }
  if (row.source === "code") throw new BlockNotEditableError(row.name, "code");
  return row;
}

/** A handle made from the name, free among the site's blocks: "Team card" → `team_card`. */
async function freeHandle(database: DatabaseOrTransaction, name: string): Promise<string> {
  const taken = new Set((await loadBlockLibrary(database)).map((block) => block.handle));
  const base =
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^(\d)/, "block_$1")
      .slice(0, 56) || "block";
  let handle = base;
  for (let count = 2; taken.has(handle); count += 1) handle = `${base}_${count}`;
  return handle;
}

export function blockFromRow(row: BlockRow): CustomBlock {
  return {
    handle: row.handle,
    name: row.name,
    icon: row.icon,
    category: row.category,
    description: row.description,
    source: row.source,
    properties: row.properties,
    design: row.design,
    template: row.template,
    renamedProperties: row.renamedProperties,
    variants: componentVariantsOf(row),
  };
}

function describeBlock(
  block: CustomBlock,
  row: BlockRow | undefined,
  uses: { pages: BlockPageUse[]; contentTypes: string[] },
): BlockResponse {
  return {
    id: row?.id ?? `plugin:${block.handle}`,
    handle: block.handle,
    name: block.name,
    icon: block.icon,
    category: block.category,
    description: block.description,
    source: block.source,
    properties: block.properties as FieldDefinition[],
    design: block.design as unknown as Record<string, unknown> | null,
    template: block.template,
    renamedProperties: { ...block.renamedProperties },
    variants: componentVariantsOf(block) as BlockResponse["variants"],
    version: row?.version ?? 1,
    editable: block.source === "site",
    usedOn: uses.pages,
    usedIn: uses.contentTypes,
    updatedAt: (row?.updatedAt ?? new Date(0)).toISOString(),
  };
}
