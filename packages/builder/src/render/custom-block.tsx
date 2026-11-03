import {
  BlockTemplateError,
  type CustomBlock,
  type PageData,
  currentValues,
  customBlockComponent,
  fillBlockTemplate,
  removeScriptsFromHtml,
} from "@lintel/builder-model";
import { drawsProps } from "./component-registry.js";
import { AsBlockCopy, usePageData } from "./data-context.js";

/**
 * An instance of one of the site's blocks. Blocks made in the builder arrive with their
 * design already filled in as children (see `expandBlockInstances`, which `renderPage`
 * runs first), drawn as copies on the canvas so the instance is selected as a whole and its
 * design can't be changed by accident. Blocks written in code are an HTML template filled
 * here, or HTML the server drew from a React component and sent with the page's data.
 *
 * A block the site doesn't have (deleted, or from a plugin that is off) shows nothing on
 * the website and a placeholder on the canvas.
 */
export const CustomBlockElement = drawsProps(
  customBlockComponent,
  ({ props, node, attributes, mode, children }) => {
    const data = usePageData();
    const block = data.blocks?.[props.block];
    const marks = { ...attributes, "data-lintel-block": props.block };
    if (!block) {
      return mode === "canvas" ? <div {...marks} data-lintel-placeholder="block" /> : null;
    }
    if (block.design) {
      return (
        <div {...marks}>{mode === "canvas" ? <AsBlockCopy>{children}</AsBlockCopy> : children}</div>
      );
    }
    const html = block.template
      ? templateHtml(
          block.template,
          currentValues(props.values, block.renamedProperties),
          block,
          data.pictures,
        )
      : (data.renderedBlocks?.[node.id] ?? "");
    const shown = mode === "canvas" ? removeScriptsFromHtml(html) : html;
    return <div {...marks} dangerouslySetInnerHTML={{ __html: shown }} />;
  },
);

function templateHtml(
  template: string,
  values: Readonly<Record<string, unknown>>,
  block: Pick<CustomBlock, "properties">,
  pictures: PageData["pictures"],
): string {
  try {
    return fillBlockTemplate(template, values, block.properties, pictures);
  } catch (error) {
    // Templates are checked when their file is synced; one edited since shows nothing.
    if (error instanceof BlockTemplateError) return "";
    throw error;
  }
}
