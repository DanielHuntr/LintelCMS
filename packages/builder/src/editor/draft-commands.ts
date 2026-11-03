import {
  createNode,
  type NodeBlueprint,
  rootNodeId,
  siteSectionSlotOf,
} from "@lintel/builder-model";
import {
  type CommandContext,
  type CommandResult,
  findInsertPlace,
  insertNodes,
} from "./commands.js";

/**
 * Puts drafted sections on the page as one change, so one Undo takes them all away. They go
 * after the selected section when there is one, otherwise at the end of the page, before the
 * site's footer.
 */
export function insertDraftedSections(
  context: CommandContext,
  blueprints: readonly NodeBlueprint[],
  label: string,
): CommandResult {
  const nodes = blueprints.map((blueprint) =>
    createNode(blueprint, context.catalogue, context.createId),
  );
  const children = context.document.root.children;
  const footerIndex = children.findIndex((child) => siteSectionSlotOf(child.id) === "footer");
  const place =
    (context.selectedId ? findInsertPlace(context, "section") : null) ??
    ({ parentId: rootNodeId, index: footerIndex === -1 ? children.length : footerIndex } as const);
  return insertNodes(context, nodes, place, label);
}
