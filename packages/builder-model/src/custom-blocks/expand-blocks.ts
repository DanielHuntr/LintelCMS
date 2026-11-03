import { bindProps, type BoundPicture } from "../data/bound-items.js";
import type { NodeStyles, PageNode } from "../document/page-document.schema.js";
import { isSafeValueFor } from "../styles/style-values.js";
import type { CreateNodeId } from "../tree/node-ids.js";
import { copyWithNewIds, retargetAnimations } from "../tree/tree-changes.js";
import {
  bindableColourStyles,
  type BindableColourStyle,
  isPropBinding,
  isShown,
  itemsBinding,
  readRows,
  rowProperties,
  styleBindingPrefix,
  valuesAsItem,
  visibleBinding,
} from "./block-bindings.js";
import {
  type BlockProperty,
  type CustomBlock,
  currentValues,
  customBlockType,
  instanceBlockHandle,
  instanceValues,
} from "./custom-block.js";
import { designForVariant, instanceVariant, componentVariantsOf } from "./component-variants.js";

/**
 * Draws instances as their block's design: before a page is drawn, each instance gets the
 * block's design as its children, with the instance's values put into the elements the
 * properties are bound to. The renderer then draws the tree as usual, so a block looks the
 * same on the canvas, on the website and in a blocks field's preview.
 *
 * The copies' ids start with the instance's id (`<instance>-<design element>`), so class
 * names and styles stay apart from the page's own and from other instances'.
 */

export interface BlockLibrary {
  blocks?: Readonly<Record<string, CustomBlock>>;
  /** Pictures from the media library that image properties point at, by asset id. */
  pictures?: Readonly<Record<string, BoundPicture>>;
}

/** The tree with every instance's design filled in. The same tree when it has none. */
export function expandBlockInstances(root: PageNode, library: BlockLibrary): PageNode {
  if (!library.blocks || !hasInstance(root)) return root;
  const expand = (node: PageNode): PageNode => {
    const handle = instanceBlockHandle(node);
    if (handle) {
      const block = library.blocks?.[handle];
      if (!block?.design) return node;
      const values = currentValues(instanceValues(node), block.renamedProperties);
      const look = designForVariant(
        block.design,
        componentVariantsOf(block),
        instanceVariant(node),
      );
      const design = expandCopy(look, values, block.properties, node.id, library);
      return { ...node, children: design ? [design] : [] };
    }
    if (node.children.length === 0) return node;
    return { ...node, children: node.children.map(expand) };
  };
  return expand(root);
}

/**
 * An instance turned back into plain elements, as "Detach" does: the design with the values
 * typed in and no bindings, with new ids. Null for blocks without a design (code blocks).
 */
export function detachBlockInstance(
  instance: PageNode,
  block: CustomBlock,
  createId: CreateNodeId,
  pictures: Readonly<Record<string, BoundPicture>> = {},
): PageNode | null {
  if (!block.design) return null;
  const values = currentValues(instanceValues(instance), block.renamedProperties);
  const look = designForVariant(
    block.design,
    componentVariantsOf(block),
    instanceVariant(instance),
  );
  const expanded = expandCopy(look, values, block.properties, instance.id, { pictures });
  if (!expanded) return null;
  return copyWithNewIds(expanded, createId);
}

/**
 * The design filled in, with what refers to its elements (an animation that plays on the
 * title, a picture that grows while the card is hovered) pointed at the copies, so each
 * instance animates its own parts.
 */
function expandCopy(
  design: PageNode,
  values: Readonly<Record<string, unknown>>,
  properties: readonly BlockProperty[],
  prefix: string,
  library: BlockLibrary,
): PageNode | null {
  const expanded = expandDesign(design, values, properties, prefix, library);
  if (!expanded) return null;
  const newIds = new Map<string, string>();
  const collect = (node: PageNode) => {
    newIds.set(node.id, `${prefix}-${node.id}`);
    node.children.forEach(collect);
  };
  collect(design);
  return retargetAnimations(expanded, newIds);
}

function hasInstance(node: PageNode): boolean {
  return node.type === customBlockType || node.children.some(hasInstance);
}

function expandDesign(
  node: PageNode,
  values: Readonly<Record<string, unknown>>,
  properties: readonly BlockProperty[],
  prefix: string,
  library: BlockLibrary,
): PageNode | null {
  const bindings = node.bindings ?? {};
  const find = (handle: string | undefined) =>
    handle ? properties.find((property) => property.handle === handle) : undefined;

  const visibleOn = bindings[visibleBinding];
  if (visibleOn && !isShown(values[visibleOn], find(visibleOn))) return null;

  const propBindings = Object.fromEntries(
    Object.entries(bindings).filter(([key]) => isPropBinding(key)),
  );
  const item = valuesAsItem(values, properties, library.pictures);
  const props = Object.keys(propBindings).length
    ? bindProps(node.props, propBindings, item)
    : node.props;

  const listHandle = bindings[itemsBinding];
  const children = listHandle
    ? readRows(values[listHandle]).flatMap((row, index) => {
        const rowFields = rowProperties(find(listHandle));
        return node.children.flatMap((child) => {
          const copy = expandDesign(child, row.data, rowFields, `${prefix}-${index}`, library);
          return copy ? [copy] : [];
        });
      })
    : node.children.flatMap((child) => {
        const copy = expandDesign(child, values, properties, prefix, library);
        return copy ? [copy] : [];
      });

  const expanded: PageNode = {
    ...node,
    id: `${prefix}-${node.id}`,
    props,
    styles: boundStyles(node.styles, bindings, values),
    children,
  };
  delete expanded.bindings;
  return expanded;
}

/** Colour properties put into the styles they're bound to, when they're safe values. */
function boundStyles(
  styles: NodeStyles,
  bindings: Readonly<Record<string, string>>,
  values: Readonly<Record<string, unknown>>,
): NodeStyles {
  let base = styles.base;
  for (const style of bindableColourStyles) {
    const handle = bindings[`${styleBindingPrefix}${style}`];
    const value = handle ? values[handle] : undefined;
    if (typeof value === "string" && value !== "" && isSafeValueFor(style, value)) {
      base = { ...base, [style satisfies BindableColourStyle]: value };
    }
  }
  return base === styles.base ? styles : { ...styles, base };
}
