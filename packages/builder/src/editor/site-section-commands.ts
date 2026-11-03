import {
  asSiteSection,
  createNode,
  findNode,
  insertNode,
  type NodeBlueprint,
  type PageDocument,
  type PageNode,
  removeNode,
  rootNodeId,
  siteSectionElements,
  siteSectionNodeIds,
  type SiteSectionSlot,
  siteSectionSlotOf,
  updateNode,
  withHiddenOnPage,
} from "@lintel/builder-model";
import type { CommandContext, CommandResult } from "./commands.js";

/**
 * The commands for the site's navigation and footer (see site-sections/ in the model): each
 * is one change to the page being edited, so it can be undone like anything else. The
 * builder sends the sections on to be saved for the whole site when the page changes.
 */

/** "navigation" or "footer", as the words show it in a sentence. */
function slotName(context: CommandContext, slot: SiteSectionSlot): string {
  return context.text(`pageBuilder.siteSection.slot.${slot}`);
}

/** The page with one of the site's sections put where it belongs: first, or last. */
function placeSiteSection(root: PageNode, slot: SiteSectionSlot, section: PageNode): PageNode {
  const id = siteSectionNodeIds[slot];
  const without = findNode(root, id) ? removeNode(root, id) : root;
  return insertNode(
    without,
    rootNodeId,
    slot === "navigation" ? 0 : without.children.length,
    section,
  );
}

/**
 * Adds a section from the Navigation or Footer group as the site's own, shown on every page.
 * One the site already has is replaced (undo brings it back).
 */
export function insertSiteSection(
  context: CommandContext,
  slot: SiteSectionSlot,
  blueprint: NodeBlueprint,
): CommandResult {
  const section = asSiteSection(createNode(blueprint, context.catalogue, context.createId), slot);
  const replaces = findNode(context.document.root, section.id) !== undefined;
  const name = slotName(context, slot);
  return {
    change: {
      label: context.text(
        replaces
          ? "pageBuilder.siteSection.history.replaced"
          : "pageBuilder.siteSection.history.added",
        { name },
      ),
      update: (document) => ({
        ...document,
        root: withHiddenOnPage(placeSiteSection(document.root, slot, section), slot, false),
      }),
      select: section.id,
    },
  };
}

/** "Use as the site's navigation": a section of this page becomes the one on every page. */
export function useAsSiteSection(
  context: CommandContext,
  nodeId: string,
  slot: SiteSectionSlot,
): CommandResult {
  const node = findNode(context.document.root, nodeId);
  if (!node || node.id === rootNodeId || siteSectionSlotOf(node.id) !== null) {
    return { refused: context.text("pageBuilder.refused.nothingSelected") };
  }
  const section = asSiteSection(node, slot);
  return {
    change: {
      label: context.text("pageBuilder.siteSection.history.madeShared", {
        name: slotName(context, slot),
      }),
      update: (document) => ({
        ...document,
        root: withHiddenOnPage(
          placeSiteSection(removeNode(document.root, nodeId), slot, section),
          slot,
          false,
        ),
      }),
      select: section.id,
    },
  };
}

/**
 * "Use as this page's own navigation": the section is drawn as the page's header (or footer)
 * and the site's is hidden on this page, so the page never has two.
 */
export function markAsPageOwn(
  context: CommandContext,
  nodeId: string,
  slot: SiteSectionSlot,
): CommandResult {
  const node = findNode(context.document.root, nodeId);
  if (!node || node.type !== "section" || siteSectionSlotOf(node.id) !== null) {
    return { refused: context.text("pageBuilder.refused.nothingSelected") };
  }
  const sharedId = siteSectionNodeIds[slot];
  return {
    change: {
      label: context.text("pageBuilder.siteSection.history.markedOwn", {
        name: slotName(context, slot),
      }),
      update: (document) => {
        let root = updateNode(document.root, nodeId, (current) => ({
          ...current,
          props: { ...current.props, element: siteSectionElements[slot] },
        }));
        if (findNode(root, sharedId)) {
          root = updateNode(root, sharedId, (current) => ({ ...current, hidden: true }));
        }
        return { ...document, root: withHiddenOnPage(root, slot, true) };
      },
    },
  };
}

/** "Hide on this page", and showing it again: this page only, every other page keeps it. */
export function setSiteSectionHidden(
  context: CommandContext,
  slot: SiteSectionSlot,
  hidden: boolean,
): CommandResult {
  const sharedId = siteSectionNodeIds[slot];
  const name = slotName(context, slot);
  return {
    change: {
      label: context.text(
        hidden ? "pageBuilder.siteSection.history.hidden" : "pageBuilder.siteSection.history.shown",
        { name },
      ),
      update: (document: PageDocument) => {
        const root = findNode(document.root, sharedId)
          ? updateNode(document.root, sharedId, (current) => ({ ...current, hidden }))
          : document.root;
        return { ...document, root: withHiddenOnPage(root, slot, hidden) };
      },
      select: hidden ? null : undefined,
    },
  };
}

/**
 * "Remove from every page": the section is taken out of the site, so every page goes back to
 * the automatic header (or footer). Undo brings it back.
 */
export function removeSiteSectionFromSite(
  context: CommandContext,
  slot: SiteSectionSlot,
): CommandResult {
  const sharedId = siteSectionNodeIds[slot];
  if (!findNode(context.document.root, sharedId)) {
    return { refused: context.text("pageBuilder.refused.nothingSelected") };
  }
  return {
    change: {
      label: context.text("pageBuilder.siteSection.history.removed", {
        name: slotName(context, slot),
      }),
      update: (document: PageDocument) => ({
        ...document,
        root: withHiddenOnPage(removeNode(document.root, sharedId), slot, false),
      }),
      select: null,
    },
  };
}
