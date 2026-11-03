import { backgroundVideoTypes } from "../backgrounds/background-video.js";
import type { ComponentCatalogue } from "../components/component-catalogue.js";
import { freeLayoutTypes } from "../free-layout/free-layout.js";
import { migrateDocument, UnknownPageVersionError } from "./migrations.js";
import {
  maxNodeCount,
  maxNodeDepth,
  type PageDocument,
  pageDocumentSchema,
  type PageNode,
  rootNodeId,
} from "./page-document.schema.js";

/**
 * The full check of a page before it is saved: migrated to the current version, the right
 * shape, ids unique, every element a known component with valid props, and every element
 * allowed where it is. Problems name the element in plain words ("Heading 3: ...").
 *
 * The server runs this on every save; the editor runs it on pages it opens, so a page that
 * was edited by hand gets a clear message rather than a broken canvas.
 */

export interface PageProblem {
  /** The element the problem is in, when there is one. */
  nodeId: string | null;
  message: string;
}

export type PageCheckResult =
  | { ok: true; document: PageDocument }
  | {
      ok: false;
      problems: PageProblem[];
      /**
       * The page as read, when it got as far as its elements: every problem then names one.
       * The website uses it to leave those elements out rather than the whole design.
       */
      document?: PageDocument;
    };

export function validatePageDocument(
  stored: unknown,
  catalogue: ComponentCatalogue,
): PageCheckResult {
  let migrated: unknown;
  try {
    migrated = migrateDocument(stored);
  } catch (error) {
    if (error instanceof UnknownPageVersionError) return failure(null, error.message);
    throw error;
  }

  const sizeProblem = checkSize(migrated);
  if (sizeProblem) return failure(null, sizeProblem);

  const parsed = pageDocumentSchema.safeParse(migrated);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return failure(
      null,
      issue
        ? `${issue.message}${describePath(issue.path)}`
        : "This page isn’t in a shape Lintel understands",
    );
  }

  const document = parsed.data as PageDocument;
  if (document.root.type !== "page" || document.root.id !== rootNodeId) {
    return failure(null, "A page should start with the page itself");
  }

  const problems: PageProblem[] = [];
  const ids = new Set<string>();
  const counts = new Map<string, number>();
  const checkNode = (node: PageNode, parent: PageNode | null): PageNode => {
    const definition = catalogue.find(node.type);
    const count = (counts.get(node.type) ?? 0) + 1;
    counts.set(node.type, count);
    const where = `${node.name || definition?.label || node.type} ${count}`;

    if (ids.has(node.id))
      problems.push({
        nodeId: node.id,
        message: `${where}: two elements have the id “${node.id}”`,
      });
    ids.add(node.id);

    if (!definition) {
      problems.push({ nodeId: node.id, message: `${where}: there is no “${node.type}” element` });
      return node;
    }
    if (parent && !catalogue.canContain(parent.type, node.type)) {
      problems.push({
        nodeId: node.id,
        message: `${where} can’t go inside ${catalogue.find(parent.type)?.label ?? parent.type}`,
      });
    }
    if (node.freeLayout && !freeLayoutTypes.includes(node.type)) {
      problems.push({ nodeId: node.id, message: `${where} can’t have a free layout` });
    }
    if (node.backgroundVideo && !backgroundVideoTypes.includes(node.type)) {
      problems.push({ nodeId: node.id, message: `${where} can’t have a background video` });
    }
    const props = definition.propsSchema.safeParse(node.props);
    if (!props.success) {
      problems.push({
        nodeId: node.id,
        message: `${where}: ${props.error.issues[0]?.message ?? "its content isn’t right"}`,
      });
    }
    return {
      ...node,
      props: props.success ? props.data : node.props,
      children: node.children.map((child) => checkNode(child, node)),
    };
  };

  const root = checkNode(document.root, null);
  return problems.length > 0
    ? { ok: false, problems, document: { ...document, root } }
    : { ok: true, document: { ...document, root } };
}

/** Counted before the schema runs, so a huge or very deep tree is refused cheaply. */
function checkSize(candidate: unknown): string | null {
  let count = 0;
  const stack: Array<{ value: unknown; depth: number }> = [];
  if (isRecord(candidate)) stack.push({ value: candidate.root, depth: 1 });
  while (stack.length > 0) {
    const { value, depth } = stack.pop() as { value: unknown; depth: number };
    if (!isRecord(value)) continue;
    count += 1;
    if (count > maxNodeCount) return `A page can have at most ${maxNodeCount} elements`;
    if (depth > maxNodeDepth) return `Elements can be nested at most ${maxNodeDepth} deep`;
    if (Array.isArray(value.children)) {
      for (const child of value.children) stack.push({ value: child, depth: depth + 1 });
    }
  }
  return null;
}

function describePath(path: readonly PropertyKey[]): string {
  const styleAt = path.indexOf("styles");
  return styleAt === -1 ? "" : ` (in the styles for ${String(path[styleAt + 1] ?? "desktop")})`;
}

function failure(nodeId: string | null, message: string): PageCheckResult {
  return { ok: false, problems: [{ nodeId, message }] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
