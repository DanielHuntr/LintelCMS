import { z } from "zod";
import {
  type NodeStyles,
  nodeStylesSchema,
  type PageNode,
  type StyleDeclarations,
} from "../document/page-document.schema.js";

/**
 * Variants: one component that comes in a few looks, such as a Button in three sizes, filled
 * or outlined, with or without an icon. docs/decisions/0059-components-with-variants.md
 * explains the choices.
 *
 * A component has variant properties (Size: Small, Medium, Large), each with a default. Its
 * design is the look with every property at its default. Every other look is stored as the
 * differences from it, for the variant values they belong to:
 *
 *   { when: { size: "small" }, elements: { d1: { styles: { base: { padding: "8px" } } } } }
 *   { when: { size: "small", style: "outline" }, elements: { ... } }
 *
 * An instance shows the design with every look whose `when` matches its choices laid on top,
 * the more specific last, so "Small" and "Outline" combine and "Small + Outline" can still
 * have a look of its own. Changing the design changes every variant that doesn't say
 * otherwise, which is what keeps one change in one place.
 */

export interface VariantOption {
  /** `small`: lowercase letters, numbers and underscores. */
  value: string;
  label: string;
}

export interface VariantProperty {
  /** `size`: lowercase letters, numbers and underscores. */
  handle: string;
  label: string;
  options: readonly VariantOption[];
  /** The option the design itself shows, and new instances start with. */
  default: string;
}

/** How one element of the design differs in a variant. */
export interface ElementLook {
  /** Styles laid over the element's own, per screen size or state. */
  styles?: Partial<NodeStyles>;
  /** Styles the element has in the design but not in this variant, as `"base.padding"`. */
  removedStyles?: readonly string[];
  /** Content and settings laid over the element's own (an icon's name, a heading's level). */
  props?: Readonly<Record<string, unknown>>;
  /** Hidden in this variant (the icon of "Icon: Off"), or shown when the design hides it. */
  hidden?: boolean;
}

export interface VariantLook {
  /** The variant values this look is for. Every one has to match. */
  when: Readonly<Record<string, string>>;
  /** By the design element's id. */
  elements: Readonly<Record<string, ElementLook>>;
}

export interface ComponentVariants {
  properties: readonly VariantProperty[];
  looks: readonly VariantLook[];
  /** Whether people with the content-only role may choose an instance's variant. */
  clientsMayChoose: boolean;
}

/** What a component without variants has, and what blocks saved before variants read as. */
export const noVariants: ComponentVariants = { properties: [], looks: [], clientsMayChoose: false };

/** An instance's choices, by variant property: `{ size: "small", style: "outline" }`. */
export type VariantSelection = Readonly<Record<string, string>>;

export const maxVariantProperties = 6;
export const maxVariantOptions = 12;
export const maxVariantLooks = 300;

/** The variants of a component, read safely from anything stored, old or new. */
export function componentVariantsOf(component: {
  variants?: ComponentVariants | null;
}): ComponentVariants {
  const variants = component.variants;
  if (!variants || typeof variants !== "object") return noVariants;
  return {
    properties: Array.isArray(variants.properties) ? variants.properties : [],
    looks: Array.isArray(variants.looks) ? variants.looks : [],
    clientsMayChoose: variants.clientsMayChoose === true,
  };
}

/** An instance's stored choices (its `variant` prop), as they are. */
export function instanceVariant(node: PageNode): Record<string, string> {
  const chosen = node.props.variant;
  if (typeof chosen !== "object" || chosen === null || Array.isArray(chosen)) return {};
  return Object.fromEntries(
    Object.entries(chosen).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

/**
 * Every variant property's value for an instance: what it chose when that is still offered,
 * otherwise the default. Choices for properties the component no longer has are left out.
 */
export function resolveSelection(
  variants: ComponentVariants,
  chosen: VariantSelection,
): Record<string, string> {
  return Object.fromEntries(
    variants.properties.map((property) => {
      const value = chosen[property.handle];
      const offered = property.options.some((option) => option.value === value);
      return [property.handle, offered && value !== undefined ? value : property.default];
    }),
  );
}

/**
 * What an instance stores: only the choices that differ from the defaults, so a component's
 * new default reaches every instance that never chose.
 */
export function storedSelection(
  variants: ComponentVariants,
  chosen: VariantSelection,
): Record<string, string> {
  const resolved = resolveSelection(variants, chosen);
  return Object.fromEntries(
    variants.properties.flatMap((property) => {
      const value = resolved[property.handle];
      return value !== undefined && value !== property.default ? [[property.handle, value]] : [];
    }),
  );
}

/**
 * Where an edit made while showing these choices goes: the values that aren't defaults.
 * With every value at its default, edits change the design itself (an empty target).
 */
export function editTarget(
  variants: ComponentVariants,
  selection: VariantSelection,
): Record<string, string> {
  return storedSelection(variants, selection);
}

/** Every combination of values, in order: the matrix a component's variants make. */
export function variantMatrix(variants: ComponentVariants): Record<string, string>[] {
  return variants.properties.reduce<Record<string, string>[]>(
    (combinations, property) =>
      combinations.flatMap((combination) =>
        property.options.map((option) => ({ ...combination, [property.handle]: option.value })),
      ),
    [{}],
  );
}

/** Whether two `when`s name the same values. */
export function sameWhen(first: VariantSelection, second: VariantSelection): boolean {
  const firstKeys = Object.keys(first);
  return (
    firstKeys.length === Object.keys(second).length &&
    firstKeys.every((key) => first[key] === second[key])
  );
}

/** Whether a look applies to a full selection. A look with no values applies to none. */
function lookMatches(look: VariantLook, selection: VariantSelection): boolean {
  const keys = Object.keys(look.when);
  return keys.length > 0 && keys.every((key) => selection[key] === look.when[key]);
}

/** The looks that apply to a selection, least specific first, so the most specific wins. */
export function matchingLooks(
  variants: ComponentVariants,
  selection: VariantSelection,
): VariantLook[] {
  const resolved = resolveSelection(variants, selection);
  return variants.looks
    .map((look, index) => ({ look, index }))
    .filter(({ look }) => lookMatches(look, resolved))
    .sort(
      (first, second) =>
        Object.keys(first.look.when).length - Object.keys(second.look.when).length ||
        first.index - second.index,
    )
    .map(({ look }) => look);
}

/** The design with looks laid over it, in order. */
export function applyLooks(design: PageNode, looks: readonly VariantLook[]): PageNode {
  if (looks.length === 0) return design;
  const apply = (node: PageNode): PageNode => {
    let changed: PageNode = node;
    for (const look of looks) {
      const element = look.elements[node.id];
      if (element) changed = applyElementLook(changed, element);
    }
    const children = node.children.map(apply);
    const childrenChanged = children.some((child, index) => child !== node.children[index]);
    return childrenChanged ? { ...changed, children } : changed;
  };
  return apply(design);
}

/** The design as one combination of values looks: what an instance with those choices shows. */
export function designForVariant(
  design: PageNode,
  variants: ComponentVariants,
  selection: VariantSelection,
): PageNode {
  if (variants.properties.length === 0) return design;
  return applyLooks(design, matchingLooks(variants, selection));
}

const styleTargets = [
  "base",
  "tablet",
  "phone",
  "hover",
  "pressed",
  "focus",
  "open",
  "selected",
] as const;
type PlainStyleTarget = (typeof styleTargets)[number];

function applyElementLook(node: PageNode, look: ElementLook): PageNode {
  let styles: NodeStyles = node.styles;
  if (look.styles || look.removedStyles) {
    const next: NodeStyles = { ...node.styles, base: { ...node.styles.base } };
    for (const target of styleTargets) {
      const added = look.styles?.[target];
      if (added) next[target] = { ...next[target], ...added };
    }
    if (look.styles?.owners) {
      next.owners = { ...next.owners };
      for (const [owner, declarations] of Object.entries(look.styles.owners)) {
        const key = owner as keyof NonNullable<NodeStyles["owners"]>;
        next.owners[key] = { ...next.owners[key], ...declarations };
      }
    }
    for (const removed of look.removedStyles ?? []) {
      const [target, property] = removed.split(".") as [PlainStyleTarget, string];
      const declarations = next[target];
      if (declarations && property in declarations) {
        const copy: StyleDeclarations = { ...declarations };
        delete copy[property as keyof StyleDeclarations];
        next[target] = copy;
      }
    }
    styles = next;
  }
  return {
    ...node,
    styles,
    props: look.props ? { ...node.props, ...look.props } : node.props,
    hidden: look.hidden ?? node.hidden,
  };
}

/** How `after` differs from `before`, element by element, for elements both have. */
export function looksBetween(before: PageNode, after: PageNode): Record<string, ElementLook> {
  const beforeById = new Map<string, PageNode>();
  const index = (node: PageNode) => {
    beforeById.set(node.id, node);
    node.children.forEach(index);
  };
  index(before);
  const elements: Record<string, ElementLook> = {};
  const visit = (node: PageNode) => {
    const old = beforeById.get(node.id);
    if (old) {
      const look = elementDifference(old, node);
      if (look) elements[node.id] = look;
    }
    node.children.forEach(visit);
  };
  visit(after);
  return elements;
}

function elementDifference(before: PageNode, after: PageNode): ElementLook | null {
  const look: {
    styles?: Partial<NodeStyles>;
    removedStyles?: string[];
    props?: Record<string, unknown>;
    hidden?: boolean;
  } = {};
  for (const target of styleTargets) {
    const old: StyleDeclarations = before.styles[target] ?? {};
    const now: StyleDeclarations = after.styles[target] ?? {};
    for (const [property, value] of Object.entries(now)) {
      if (old[property as keyof StyleDeclarations] !== value) {
        look.styles ??= {};
        look.styles[target] = { ...look.styles[target], [property]: value };
      }
    }
    for (const property of Object.keys(old)) {
      if (!(property in now)) (look.removedStyles ??= []).push(`${target}.${property}`);
    }
  }
  const oldOwners = before.styles.owners ?? {};
  for (const [owner, declarations] of Object.entries(after.styles.owners ?? {})) {
    const key = owner as keyof NonNullable<NodeStyles["owners"]>;
    const old: StyleDeclarations = oldOwners[key] ?? {};
    for (const [property, value] of Object.entries(declarations ?? {})) {
      if (old[property as keyof StyleDeclarations] !== value) {
        look.styles ??= {};
        look.styles.owners = {
          ...look.styles.owners,
          [key]: { ...look.styles.owners?.[key], [property]: value },
        };
      }
    }
  }
  for (const [prop, value] of Object.entries(after.props)) {
    if (JSON.stringify(before.props[prop]) !== JSON.stringify(value)) {
      look.props = { ...look.props, [prop]: value };
    }
  }
  if (before.hidden !== after.hidden) look.hidden = after.hidden;
  return Object.keys(look).length > 0 ? look : null;
}

/**
 * Keeps an edit made in the designer while it shows `selection`, and says where it went.
 *
 * - With every value at its default, the edit is the design.
 * - Otherwise, the design takes any new, moved or renamed elements (they belong to every
 *   variant), each element keeping its own look, and the differences from what the design
 *   and the less specific looks give become the look for exactly these values. An element
 *   deleted while showing a variant is hidden in that variant instead.
 */
export function recordVariantEdit(
  design: PageNode,
  variants: ComponentVariants,
  selection: VariantSelection,
  edited: PageNode,
): { design: PageNode; variants: ComponentVariants } {
  const target = editTarget(variants, selection);
  if (Object.keys(target).length === 0) {
    return { design: edited, variants: withoutMissingElements(variants, edited) };
  }
  const { design: restructured, removed } = mergeStructure(design, edited);
  const others = variants.looks.filter((look) => !sameWhen(look.when, target));
  const previous = designForVariant(restructured, { ...variants, looks: others }, selection);
  const elements = looksBetween(previous, edited);
  for (const id of removed) elements[id] = { ...elements[id], hidden: true };
  const looks =
    Object.keys(elements).length === 0 ? others : [...others, { when: target, elements }];
  return { design: restructured, variants: { ...variants, looks } };
}

/** Looks without elements the design no longer has (and without looks left empty). */
export function withoutMissingElements(
  variants: ComponentVariants,
  design: PageNode,
): ComponentVariants {
  const ids = new Set<string>();
  const index = (node: PageNode) => {
    ids.add(node.id);
    node.children.forEach(index);
  };
  index(design);
  const looks = variants.looks.flatMap((look): VariantLook[] => {
    const elements = Object.fromEntries(
      Object.entries(look.elements).filter(([id]) => ids.has(id)),
    );
    return Object.keys(elements).length > 0 ? [{ ...look, elements }] : [];
  });
  return { ...variants, looks };
}

/**
 * The edited tree's structure with the design's own looks: an element both have keeps the
 * design's content and styles (the edit's are the variant's), and takes the edit's place,
 * name, bindings and animation. Elements only the design has go back where they were.
 */
function mergeStructure(
  design: PageNode,
  edited: PageNode,
): { design: PageNode; removed: string[] } {
  const designById = new Map<string, { node: PageNode; parent: string | null; index: number }>();
  const index = (node: PageNode, parent: string | null, at: number) => {
    designById.set(node.id, { node, parent, index: at });
    node.children.forEach((child, childIndex) => index(child, node.id, childIndex));
  };
  index(design, null, 0);
  const editedIds = new Set<string>();
  const collect = (node: PageNode) => {
    editedIds.add(node.id);
    node.children.forEach(collect);
  };
  collect(edited);

  // The outermost elements deleted in the edit, to put back by their old parent.
  const removed: string[] = [];
  const putBack = new Map<string, Array<{ node: PageNode; index: number }>>();
  for (const [id, place] of designById) {
    if (editedIds.has(id) || place.parent === null) continue;
    if (!editedIds.has(place.parent)) continue;
    removed.push(id);
    const list = putBack.get(place.parent) ?? [];
    list.push({ node: place.node, index: place.index });
    putBack.set(place.parent, list);
  }

  const merge = (node: PageNode): PageNode => {
    const own = designById.get(node.id)?.node;
    const children = node.children.map(merge);
    for (const back of (putBack.get(node.id) ?? []).sort((a, b) => a.index - b.index)) {
      children.splice(Math.min(back.index, children.length), 0, back.node);
    }
    if (!own) return { ...node, children };
    return { ...node, props: own.props, styles: own.styles, hidden: own.hidden, children };
  };
  return { design: merge(edited), removed };
}

/** Lowercase letters, numbers and underscores, as block handles are. */
const variantHandlePattern = /^[a-z][a-z0-9_]{0,63}$/;

const variantHandleSchema = z
  .string()
  .regex(variantHandlePattern, { error: "A variant’s handle should look like “size”" });

const variantLabelSchema = z
  .string({ error: "Please give each variant a name" })
  .trim()
  .min(1, { error: "Please give each variant a name" })
  .max(60, { error: "Variant names can be at most 60 characters" });

const elementLookSchema = z.object({
  styles: nodeStylesSchema.partial().optional(),
  removedStyles: z
    .array(
      z
        .string()
        .regex(/^[a-z]+\.[A-Za-z]+$/, { error: "A removed style looks like “base.padding”" }),
    )
    .max(100)
    .optional(),
  props: z.record(z.string(), z.unknown()).optional(),
  hidden: z.boolean().optional(),
});

/** The shape of a component's variants, as stored and as sent. */
export const componentVariantsSchema = z.object({
  properties: z
    .array(
      z.object({
        handle: variantHandleSchema,
        label: variantLabelSchema,
        options: z
          .array(z.object({ value: variantHandleSchema, label: variantLabelSchema }))
          .min(2, { error: "A variant needs at least two choices, like Small and Large" })
          .max(maxVariantOptions, {
            error: `A variant can have at most ${maxVariantOptions} choices`,
          }),
        default: variantHandleSchema,
      }),
    )
    .max(maxVariantProperties, {
      error: `A component can have at most ${maxVariantProperties} variants`,
    })
    .default([]),
  looks: z
    .array(
      z.object({
        when: z.record(variantHandleSchema, variantHandleSchema),
        elements: z.record(z.string().max(100), elementLookSchema),
      }),
    )
    .max(maxVariantLooks, { error: "That is more variant looks than a component can keep" })
    .default([]),
  clientsMayChoose: z.boolean().default(false),
});

/**
 * Problems with variants against the design they belong to, as plain sentences: handles
 * and choices used twice, a default that isn't one of the choices, looks for variants or
 * elements that aren't there. An empty list when all is well.
 */
export function variantProblems(variants: ComponentVariants, design: PageNode | null): string[] {
  const problems: string[] = [];
  const handles = new Set<string>();
  for (const property of variants.properties) {
    if (handles.has(property.handle)) {
      problems.push(`Two variants are called “${property.handle}”`);
    }
    handles.add(property.handle);
    const values = new Set<string>();
    for (const option of property.options) {
      if (values.has(option.value)) {
        problems.push(`${property.label} has “${option.value}” twice`);
      }
      values.add(option.value);
    }
    if (!values.has(property.default)) {
      problems.push(
        `${property.label} starts as “${property.default}”, which isn’t one of its choices`,
      );
    }
  }
  if (variants.properties.length > 0 && !design) {
    problems.push("Only components designed in the builder can have variants");
  }
  const ids = new Set<string>();
  const index = (node: PageNode) => {
    ids.add(node.id);
    node.children.forEach(index);
  };
  if (design) index(design);
  for (const look of variants.looks) {
    for (const [handle, value] of Object.entries(look.when)) {
      const property = variants.properties.find((candidate) => candidate.handle === handle);
      if (!property) {
        problems.push(`A look is for a variant “${handle}” the component doesn’t have`);
      } else if (!property.options.some((option) => option.value === value)) {
        problems.push(`A look is for ${property.label} “${value}”, which isn’t one of its choices`);
      }
    }
    for (const id of Object.keys(look.elements)) {
      if (!ids.has(id)) problems.push(`A look changes an element “${id}” the design doesn’t have`);
    }
  }
  return [...new Set(problems)];
}

/** The variants with a property's choices renamed or removed, keeping the looks consistent. */
export function withoutUnknownLooks(variants: ComponentVariants): ComponentVariants {
  const looks = variants.looks.filter((look) =>
    Object.entries(look.when).every(([handle, value]) =>
      variants.properties.some(
        (property) =>
          property.handle === handle && property.options.some((option) => option.value === value),
      ),
    ),
  );
  return { ...variants, looks };
}
