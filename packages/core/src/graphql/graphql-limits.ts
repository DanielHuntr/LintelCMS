import {
  type ASTVisitor,
  type FieldNode,
  GraphQLError,
  Kind,
  type OperationDefinitionNode,
  type SelectionSetNode,
  type ValidationContext,
} from "graphql";

/**
 * Two validation rules that stop a single request from costing too much, checked before
 * anything runs:
 *
 *   - depth: how many levels a query nests. Today's schema can't nest far, but fields that
 *     point at other entries will, and a loop of those could otherwise go on forever;
 *   - cost: roughly how many values a query asks for. Each value costs 1 and each object 2,
 *     and everything under a field with `perPage` counts once per item it may return.
 *
 * Introspection (`__schema`, `__type`) is left out of both: GraphiQL and code generators
 * need it, and only requests with a token or a session may use it (see graphql.routes.ts).
 * `__typename` counts like any other value, or a query of thousands of aliased
 * `__typename`s would cost nothing.
 */
const INTROSPECTION_FIELDS = new Set(["__schema", "__type"]);
export interface QueryLimits {
  maxDepth: number;
  maxCost: number;
}

const DEFAULT_PAGE_SIZE = 25;
const LARGEST_PAGE_SIZE = 100;

export function queryLimitRules(limits: QueryLimits) {
  return [maxDepthRule(limits.maxDepth), maxCostRule(limits.maxCost)];
}

export function maxDepthRule(maxDepth: number) {
  return (context: ValidationContext): ASTVisitor => ({
    OperationDefinition(operation: OperationDefinitionNode) {
      const depth = measure(context, operation.selectionSet, "max", (_field, children) =>
        children === undefined ? 1 : 1 + children,
      );
      if (depth > maxDepth) {
        context.reportError(
          new GraphQLError(
            `This query nests ${depth} levels deep; the most allowed is ${maxDepth}. Ask for less at a time.`,
            { nodes: [operation], extensions: { code: "QUERY_TOO_DEEP" } },
          ),
        );
      }
    },
  });
}

export function maxCostRule(maxCost: number) {
  return (context: ValidationContext): ASTVisitor => ({
    OperationDefinition(operation: OperationDefinitionNode) {
      const cost = measure(context, operation.selectionSet, "sum", (field, children) =>
        children === undefined ? 1 : 2 + children * pageSizeOf(field),
      );
      if (cost > maxCost) {
        context.reportError(
          new GraphQLError(
            `This query could return about ${cost} values; the most allowed is ${maxCost}. Ask for fewer fields, or smaller pages.`,
            { nodes: [operation], extensions: { code: "QUERY_TOO_COSTLY" } },
          ),
        );
      }
    },
  });
}

type Combine = (field: FieldNode, childrenResult: number | undefined) => number;

/**
 * Walks a selection set, following fragments, and combines each field's result with its
 * children's: the deepest child for depth ("max"), all of them for cost ("sum").
 */
function measure(
  context: ValidationContext,
  selectionSet: SelectionSetNode,
  mode: "max" | "sum",
  combine: Combine,
  visitedFragments: ReadonlySet<string> = new Set(),
): number {
  let total = 0;
  for (const selection of selectionSet.selections) {
    let result: number;
    if (selection.kind === Kind.FIELD) {
      if (INTROSPECTION_FIELDS.has(selection.name.value)) {
        continue;
      }
      const children = selection.selectionSet
        ? measure(context, selection.selectionSet, mode, combine, visitedFragments)
        : undefined;
      result = combine(selection, children);
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      result = measure(context, selection.selectionSet, mode, combine, visitedFragments);
    } else {
      const name = selection.name.value;
      const fragment = context.getFragment(name);
      // A fragment used inside itself is reported by GraphQL's own rules; just don't loop.
      if (!fragment || visitedFragments.has(name)) {
        continue;
      }
      const visited = new Set([...visitedFragments, name]);
      result = measure(context, fragment.selectionSet, mode, combine, visited);
    }
    total = mode === "sum" ? total + result : Math.max(total, result);
  }
  return total;
}

/**
 * How many items a field may return: its `perPage` when written in the query, the
 * largest page when it comes from a variable (not known yet), a default page for list
 * queries that don't say, and 1 for everything else.
 */
function pageSizeOf(field: FieldNode): number {
  const perPage = field.arguments?.find((argument) => argument.name.value === "perPage");
  if (perPage?.value.kind === Kind.INT) {
    return Math.min(Math.max(Number(perPage.value.value), 1), LARGEST_PAGE_SIZE);
  }
  if (perPage) {
    return LARGEST_PAGE_SIZE;
  }
  const listsItems = field.selectionSet?.selections.some(
    (selection) => selection.kind === Kind.FIELD && selection.name.value === "items",
  );
  return listsItems ? DEFAULT_PAGE_SIZE : 1;
}
