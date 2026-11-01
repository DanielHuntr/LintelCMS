import {
  assignClassNames,
  createNode,
  type CreateNodeId,
  findNode,
  type NodeStyles,
  type PageDocument,
  type PageNode,
  parseHtml,
  walkElements,
  walkNodes,
  writeHtml,
} from "@lintel/builder-model";
import type { ComponentRegistry } from "../render/component-registry.js";
import { renderPage } from "../render/render-page.js";

/**
 * "Convert to code": an element and everything inside it becomes one code block with the
 * same HTML and CSS, for developers to change by hand. Its classes get a `-code` ending, so
 * they can't clash with the builder's own class names as the page changes around it. The
 * texts and pictures are marked editable, so other people can still change them visually.
 */
export function convertToCode(
  document: PageDocument,
  nodeId: string,
  registry: ComponentRegistry,
  createId: CreateNodeId,
): PageNode | null {
  const node = findNode(document.root, nodeId);
  if (!node) return null;
  const { html, css } = renderPage(document, registry, { nodeId });
  const classNames = assignClassNames(document.root, registry.catalogue);
  const renamed = new Map<string, string>();
  walkNodes(node, (inner) => {
    const className = classNames.get(inner.id);
    if (className) renamed.set(className, `${className}-code`);
  });

  const nodes = parseHtml(html);
  let markerCount = 0;
  walkElements(nodes, (element) => {
    element.attributes = element.attributes.map(([name, value]) =>
      name === "class"
        ? [
            name,
            value
              .split(/\s+/)
              .map((each) => renamed.get(each) ?? each)
              .join(" "),
          ]
        : [name, value],
    );
    const isTextElement =
      /^(h[1-6]|p|a|figcaption|li)$/.test(element.tag) &&
      element.children.every((child) => child.kind === "text");
    if (isTextElement && element.children.length > 0) {
      markerCount += 1;
      element.attributes.push(["data-lintel-field", `text-${markerCount}`]);
    }
    if (element.tag === "img") {
      markerCount += 1;
      element.attributes.push(["data-lintel-image", `picture-${markerCount}`]);
    }
  });

  const renamedCss = css.replace(/\.([a-z][a-z0-9-]*)/g, (match, className: string) => {
    const next = renamed.get(className);
    return next ? `.${next}` : match;
  });
  const block = createNode(
    {
      type: "codeBlock",
      name: node.name || undefined,
      props: { html: writeHtml(nodes), css: renamedCss },
    },
    registry.catalogue,
    createId,
  );
  return { ...block, styles: { base: {} } as NodeStyles };
}
