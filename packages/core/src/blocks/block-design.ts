import {
  type BlockProperty,
  type ComponentVariants,
  componentVariantsSchema,
  variantProblems,
  createEmptyPage,
  customBlockType,
  isPropBinding,
  itemsBinding,
  type PageNode,
  rowProperties,
  styleBindingPrefix,
  validatePageDocument,
  visibleBinding,
} from "@lintel/builder-model";
import { InvalidFieldsError } from "../http/http-errors.js";
import { pageComponentCatalogue } from "../pages/page-components.js";

/**
 * A block's design is one element (with everything inside it), checked like a page: known
 * elements, valid props and styles. On top of that, it can't hold another block, and every
 * binding has to point at a property of a kind that suits it (see block-bindings.ts in the
 * page model). Problems come back under `design`.
 */
export function checkBlockDesign(
  candidate: unknown,
  properties: readonly BlockProperty[],
): PageNode {
  const page = createEmptyPage();
  const checked = validatePageDocument(
    { ...page, root: { ...page.root, children: [candidate] } },
    pageComponentCatalogue,
  );
  if (!checked.ok) {
    throw new InvalidFieldsError({
      design: checked.problems[0]?.message ?? "The design isn’t right",
    });
  }
  const design = checked.document.root.children[0] as PageNode;
  const problem = findDesignProblem(design, properties);
  if (problem) throw new InvalidFieldsError({ design: problem });
  return design;
}

/**
 * A component's variants: their shape, and that they fit the design (choices used once, a
 * default that is one of them, looks only for elements the design has). Problems come back
 * under `variants`. Left out, a component has none.
 */
export function checkComponentVariants(
  candidate: unknown,
  design: PageNode | null,
): ComponentVariants {
  const parsed = componentVariantsSchema.safeParse(candidate ?? {});
  if (!parsed.success) {
    throw new InvalidFieldsError({
      variants: parsed.error.issues[0]?.message ?? "The variants aren’t right",
    });
  }
  const variants = parsed.data as ComponentVariants;
  const [problem] = variantProblems(variants, design);
  if (problem) throw new InvalidFieldsError({ variants: problem });
  return variants;
}

function findDesignProblem(node: PageNode, properties: readonly BlockProperty[]): string | null {
  if (node.type === customBlockType) {
    return "A block can’t have another block inside it. Detach that one first.";
  }
  const name = node.name || node.type;
  let childProperties = properties;
  for (const [binding, handle] of Object.entries(node.bindings ?? {})) {
    const property = properties.find((candidate) => candidate.handle === handle);
    if (!property) return `${name} shows “${handle}”, which isn’t one of the block’s properties`;
    const wants =
      binding === visibleBinding
        ? ["toggle", "revealer"]
        : binding === itemsBinding
          ? ["repeater"]
          : binding.startsWith(styleBindingPrefix)
            ? ["colour"]
            : null;
    if (wants && !wants.includes(property.type)) {
      return `${name} can’t use ${property.label} for that: it needs a ${wants[0]} property`;
    }
    if (
      isPropBinding(binding) &&
      ["repeater", "toggle", "revealer", "group"].includes(property.type)
    ) {
      return `${name} can’t show ${property.label}: it isn’t something an element can show`;
    }
    if (binding === itemsBinding) childProperties = rowProperties(property);
  }
  for (const child of node.children) {
    const problem = findDesignProblem(child, childProperties);
    if (problem) return problem;
  }
  return null;
}

/** The design with bindings to renamed properties pointing at their new handles. */
export function renameBindings(
  design: unknown,
  renames: Readonly<Record<string, string>>,
): unknown {
  if (Object.keys(renames).length === 0 || typeof design !== "object" || design === null) {
    return design;
  }
  const rename = (node: Record<string, unknown>, isRow: boolean): Record<string, unknown> => {
    const bindings = node.bindings as Record<string, string> | undefined;
    const renamed =
      bindings && !isRow
        ? Object.fromEntries(
            Object.entries(bindings).map(([key, handle]) => [key, renames[handle] ?? handle]),
          )
        : bindings;
    const children = Array.isArray(node.children)
      ? (node.children as Record<string, unknown>[])
      : [];
    const insideRow = isRow || Boolean(bindings?.[itemsBinding]);
    return {
      ...node,
      ...(renamed ? { bindings: renamed } : {}),
      children: children.map((child) => rename(child, insideRow)),
    };
  };
  return rename(design as Record<string, unknown>, false);
}
