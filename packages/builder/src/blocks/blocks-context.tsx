import type { BlockProperty, BoundPicture, CustomBlock, PageNode } from "@lintel/builder-model";
import { createContext, type ReactNode, useContext } from "react";

/**
 * What the app tells the builder about the site's own blocks, and what it does for it:
 * the blocks to offer in Insert and draw on the canvas, saving a new one, opening one's
 * design, and drawing a block's property form with the app's own field editors.
 */
export interface BuilderBlocks {
  library: readonly CustomBlock[];
  /** Pictures image properties point at, by asset id, so the canvas can show them. */
  pictures?: Readonly<Record<string, BoundPicture>>;
  /** HTML the server drew for blocks that are React components in code, by instance id. */
  renderedBlocks?: Readonly<Record<string, string>>;
  /** Has `builder:blocks`: may make blocks and open their designs. Everyone may use them. */
  canManage: boolean;
  /** Saves a new block; resolves with it, or a sentence saying why it couldn't. */
  create?: (draft: NewBlockDraft) => Promise<CustomBlock | { problem: string }>;
  /** Opens a block's design (the app saves the page first). */
  editDesign?: (handle: string) => void;
  /** The block's form, drawn with the app's field editors; a simple one is used without it. */
  renderProperties?: (form: BlockPropertyForm) => ReactNode;
}

export interface NewBlockDraft {
  name: string;
  icon: string;
  category: string;
  design: PageNode;
  properties: BlockProperty[];
}

/** One instance's form: its block's properties, the values, and where changes go. */
export interface BlockPropertyForm {
  block: CustomBlock;
  values: Readonly<Record<string, unknown>>;
  onChange: (values: Record<string, unknown>) => void;
}

/**
 * Editing a block's design (the "master"): the page is the design, and elements' bindings
 * point at the block's properties, which the app keeps and saves with the design.
 */
export interface BlockMaster {
  block: CustomBlock;
  /** Read-only for blocks defined in code. */
  isReadOnly: boolean;
  onPropertiesChange: (properties: BlockProperty[]) => void;
}

export const noBlocks: BuilderBlocks = { library: [], canManage: false };

const BlocksContext = createContext<BuilderBlocks>(noBlocks);
const BlockMasterContext = createContext<BlockMaster | null>(null);

export function BlocksProvider({
  blocks,
  master,
  children,
}: {
  blocks: BuilderBlocks;
  master: BlockMaster | null;
  children: ReactNode;
}) {
  return (
    <BlocksContext.Provider value={blocks}>
      <BlockMasterContext.Provider value={master}>{children}</BlockMasterContext.Provider>
    </BlocksContext.Provider>
  );
}

export function useBuilderBlocks(): BuilderBlocks {
  return useContext(BlocksContext);
}

export function useBlockMaster(): BlockMaster | null {
  return useContext(BlockMasterContext);
}

/** The library by handle, as the renderer reads it from the page's data. */
export function blocksByHandle(
  library: readonly CustomBlock[],
): Readonly<Record<string, CustomBlock>> {
  return Object.fromEntries(library.map((block) => [block.handle, block]));
}
