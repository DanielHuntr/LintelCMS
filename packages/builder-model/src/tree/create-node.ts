import type { ComponentCatalogue } from "../components/component-catalogue.js";
import type { NodeBlueprint } from "../components/component-definition.js";
import type { NodeStyles, PageNode } from "../document/page-document.schema.js";
import type { CreateNodeId } from "./node-ids.js";

export class UnknownComponentError extends Error {
  constructor(type: string) {
    super(`There is no “${type}” element. It may come from a plugin that is switched off.`);
    this.name = "UnknownComponentError";
  }
}

/**
 * Makes a node, with ids, from a blueprint such as a section template. Whatever the blueprint
 * leaves out comes from the component: its default props, styles and children.
 */
export function createNode(
  blueprint: NodeBlueprint,
  catalogue: ComponentCatalogue,
  createId: CreateNodeId,
): PageNode {
  const definition = catalogue.find(blueprint.type);
  if (!definition) throw new UnknownComponentError(blueprint.type);
  const children = blueprint.children ?? definition.defaultChildren ?? [];
  return {
    id: createId(),
    type: blueprint.type,
    name: blueprint.name ?? "",
    props: structuredCopy({ ...definition.defaultProps, ...(blueprint.props ?? {}) }),
    styles: copyStyles(blueprint.styles ?? definition.defaultStyles ?? { base: {} }),
    children: children.map((child) => createNode(child, catalogue, createId)),
    hidden: false,
    locked: false,
    ...(blueprint.animation ? { animation: structuredCopy(blueprint.animation) } : {}),
    ...(blueprint.effects?.length ? { effects: structuredCopy([...blueprint.effects]) } : {}),
    ...(blueprint.freeLayout ? { freeLayout: { ...blueprint.freeLayout } } : {}),
    ...(blueprint.backgroundVideo ? { backgroundVideo: { ...blueprint.backgroundVideo } } : {}),
    ...(blueprint.bindings ? { bindings: { ...blueprint.bindings } } : {}),
  };
}

function copyStyles(styles: NodeStyles): NodeStyles {
  return structuredCopy({ ...styles, base: styles.base ?? {} });
}

/** Props are plain JSON, so a JSON round trip is a full copy without shared arrays. */
function structuredCopy<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}
