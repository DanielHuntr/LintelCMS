import {
  type BindableField,
  type BlockProperty,
  type BoundFieldKind,
  buildBlockDesign,
  type ComponentCatalogue,
  type CustomBlock,
  customBlockType,
  findPropertyCandidates,
  newInstanceProps,
  type NodeBlueprint,
  type PageNode,
  type PropertyChoice,
} from "@lintel/builder-model";
import type { InsertItem } from "../panels/insert-library.js";

/**
 * The plain logic behind the builder's blocks: what Insert lists for them, what a new
 * instance is, which properties an element's prop can show, and changing what editors can
 * change in a block's design without losing its properties' settings.
 */

/** Each block in Insert, under "Your site's blocks", before the ready-made ones. */
export function blockInsertItems(library: readonly CustomBlock[]): InsertItem[] {
  return [...library]
    .sort(
      (first, second) =>
        first.category.localeCompare(second.category) || first.name.localeCompare(second.name),
    )
    .map((block) => ({
      key: `block:${block.handle}`,
      kind: "elements",
      label: block.name,
      description: [block.category, block.description].filter(Boolean).join(": "),
      group: "blocks",
      groupTitle: "pageBuilder.insert.category.blocks",
      type: customBlockType,
      icon: block.icon,
    }));
}

/** A new instance: no values yet, so it looks exactly like the block's design. */
export function instanceBlueprint(block: CustomBlock): NodeBlueprint {
  return { type: customBlockType, name: block.name, props: newInstanceProps(block.handle) };
}

/** What kind of value a property gives an element's prop, for the "Shows" picker. */
function boundKindOf(property: BlockProperty): BoundFieldKind | null {
  switch (property.type) {
    case "image":
      return "image";
    case "link":
    case "url":
      return "link";
    case "date":
      return "date";
    case "toggle":
    case "revealer":
    case "repeater":
    case "colour":
    case "richText":
      return null;
    default:
      return "text";
  }
}

/** A block's properties as the fields an element in its design can show. */
export function blockBindableFields(properties: readonly BlockProperty[]): BindableField[] {
  return properties.flatMap((property) => {
    const kind = boundKindOf(property);
    return kind ? [{ path: property.handle, label: property.label, kind }] : [];
  });
}

/** What the mapping dialog starts with: the parts already bound, with their labels. */
export function currentChoices(
  design: PageNode,
  properties: readonly BlockProperty[],
  catalogue: ComponentCatalogue,
): PropertyChoice[] {
  const labelOf = (handle: string) =>
    properties.find((property) => property.handle === handle)?.label ?? handle;
  const bound = new Map<string, string>();
  const visit = (node: PageNode) => {
    for (const [binding, handle] of Object.entries(node.bindings ?? {})) {
      bound.set(`${node.id}:${binding}`, labelOf(handle));
    }
    // A list's row design is bound to the row's fields, which the list itself stands for.
    if (!node.bindings?.items) node.children.forEach(visit);
  };
  visit(design);
  return findPropertyCandidates(design, catalogue).flatMap((candidate) => {
    const label = bound.get(candidate.id);
    return label === undefined ? [] : [{ candidateId: candidate.id, label }];
  });
}

/**
 * The design with new choices of what editors can change. Properties that stay keep their
 * settings (help text, validation, conditions...), matched by handle and type.
 */
export function remapBlockDesign(
  design: PageNode,
  choices: readonly PropertyChoice[],
  existing: readonly BlockProperty[],
  catalogue: ComponentCatalogue,
): { design: PageNode; properties: BlockProperty[] } {
  const rebuilt = buildBlockDesign(design, choices, catalogue);
  const properties = rebuilt.properties.map((property) => {
    const kept = existing.find(
      (candidate) => candidate.handle === property.handle && candidate.type === property.type,
    );
    return kept ? { ...kept, label: property.label } : property;
  });
  return { design: rebuilt.design, properties };
}
