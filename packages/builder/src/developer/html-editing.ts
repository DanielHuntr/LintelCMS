import {
  assignClassNames,
  type ComponentCatalogue,
  findPlace,
  importHtml,
  insertNode,
  type NodeStyles,
  type PageDocument,
  type PageNode,
  removeNode,
  walkNodes,
} from "@lintel/builder-model";
import type { CommandContext, CommandResult } from "../editor/commands.js";
import { isLocked, layerName } from "../editor/commands.js";

/**
 * Editing an element's HTML directly. The HTML is read back into builder elements with the
 * same rules as pasting (`importHtml`), and elements keep their styles and layer names when
 * their class is still there, so a developer's edit stays visually editable. Whatever
 * doesn't map becomes a code block.
 */

export function stylesByClassName(
  document: PageDocument,
  catalogue: ComponentCatalogue,
): Map<string, { name: string; styles: NodeStyles }> {
  const classNames = assignClassNames(document.root, catalogue);
  const styles = new Map<string, { name: string; styles: NodeStyles }>();
  walkNodes(document.root, (node) => {
    const className = classNames.get(node.id);
    if (className) styles.set(className, { name: node.name, styles: node.styles });
  });
  return styles;
}

export interface HtmlEditResult {
  result: CommandResult;
  codeBlocks: number;
  skipped: number;
}

export function replaceWithHtml(
  context: CommandContext,
  nodeId: string,
  html: string,
  allowCode: boolean,
): HtmlEditResult {
  const { document, catalogue, text } = context;
  const place = findPlace(document.root, nodeId);
  const original = place?.parent.children[place.index];
  if (!place || !original)
    return {
      result: { refused: text("pageBuilder.refused.nothingSelected") },
      codeBlocks: 0,
      skipped: 0,
    };
  if (isLocked(document, nodeId)) {
    return {
      result: {
        refused: text("pageBuilder.refused.locked", { name: layerName(original, catalogue) }),
      },
      codeBlocks: 0,
      skipped: 0,
    };
  }
  const imported = importHtml(html, {
    catalogue,
    createId: context.createId,
    allowCode,
    stylesByClass: stylesByClassName(document, catalogue),
  });
  const misplaced = imported.nodes.find(
    (node) => !catalogue.canContain(place.parent.type, node.type),
  );
  if (misplaced) {
    return {
      result: {
        refused: text("pageBuilder.refused.cantGoInside", {
          name: layerName(misplaced, catalogue),
          parent: layerName(place.parent, catalogue),
        }),
      },
      codeBlocks: imported.codeBlocks,
      skipped: imported.skipped,
    };
  }
  const update = (page: PageDocument): PageDocument => {
    let root: PageNode = removeNode(page.root, nodeId);
    imported.nodes.forEach((node, offset) => {
      root = insertNode(root, place.parent.id, place.index + offset, node);
    });
    return { ...page, root };
  };
  return {
    result: {
      change: {
        label: text("pageBuilder.history.editedHtml", { name: layerName(original, catalogue) }),
        update,
        select: imported.nodes[0]?.id ?? null,
      },
    },
    codeBlocks: imported.codeBlocks,
    skipped: imported.skipped,
  };
}
