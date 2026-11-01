import {
  type AnyComponentDefinition,
  assignClassNames,
  compileStylesheet,
  findNode,
  type PageDocument,
  type PageNode,
} from "@lintel/builder-model";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentRegistry, RenderMode } from "./component-registry.js";

/**
 * Turns a page design into HTML and a stylesheet: the same function draws the editor's canvas
 * and the published page, so what people see while editing is what visitors get.
 *
 *   const { html, css } = renderPage(page, standardRegistry);
 *
 * The HTML has one class per element and nothing else, unless `mode` is "canvas", which adds
 * `data-lintel-node` (and `data-lintel-text` on editable text) for selecting and editing.
 * The CSS uses the theme's tokens (`var(--lintel-color-brand)`); put the theme's stylesheet
 * before it. The output only depends on the page, so the same page always gives the same text.
 */

export interface RenderOptions {
  mode?: RenderMode;
  /** Draw only this element and what's inside it, as the code view does. */
  nodeId?: string;
}

export interface RenderedPage {
  html: string;
  css: string;
}

export function renderPage(
  document: PageDocument,
  registry: ComponentRegistry,
  { mode = "site", nodeId }: RenderOptions = {},
): RenderedPage {
  const classNames = assignClassNames(document.root, registry.catalogue);
  const start = nodeId ? findNode(document.root, nodeId) : document.root;
  if (!start || start.hidden) return { html: "", css: "" };
  const html = renderToStaticMarkup(
    <NodeView node={start} registry={registry} classNames={classNames} mode={mode} />,
  );
  return { html, css: compileStylesheet(start, classNames) };
}

/**
 * Props checked against the component's schema, remembered per props object. Unchanged
 * nodes keep their props object between versions of the page, so redrawing the canvas after
 * a change only checks what changed.
 */
const checkedPropsCache = new WeakMap<object, Record<string, unknown>>();

function checkedProps(node: PageNode, definition: AnyComponentDefinition): Record<string, unknown> {
  const cached = checkedPropsCache.get(node.props);
  if (cached) return cached;
  const parsed = definition.propsSchema.safeParse(node.props);
  const props = parsed.success ? parsed.data : definition.defaultProps;
  checkedPropsCache.set(node.props, props);
  return props;
}

interface NodeViewProps {
  node: PageNode;
  registry: ComponentRegistry;
  classNames: ReadonlyMap<string, string>;
  mode: RenderMode;
}

function NodeView({ node, registry, classNames, mode }: NodeViewProps): ReactElement | null {
  if (node.hidden) return null;
  const className = classNames.get(node.id) ?? node.type;
  const entry = registry.find(node.type);
  if (!entry) {
    return mode === "canvas" ? (
      <div className={className} data-lintel-node={node.id} data-lintel-placeholder="unknown" />
    ) : null;
  }
  const props = checkedProps(node, entry.definition);
  const { Render } = entry;
  return (
    <Render
      props={props}
      node={node}
      mode={mode}
      attributes={mode === "canvas" ? { className, "data-lintel-node": node.id } : { className }}
      editableText={(prop): Record<string, string> =>
        mode === "canvas" ? { "data-lintel-text": prop } : {}
      }
    >
      {node.children.map((child) => (
        <NodeView
          key={child.id}
          node={child}
          registry={registry}
          classNames={classNames}
          mode={mode}
        />
      ))}
    </Render>
  );
}
